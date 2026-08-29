/**
 * Security Utilities for Sparkling Silver
 * Handles rate limiting, input validation, CSRF protection, and security headers
 */

// Rate limiting store (per-instance, in-memory)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// CSRF token store (per-instance, in-memory)
const csrfTokenStore = new Set<string>();

/**
 * Security Headers Middleware
 * Adds critical security headers to all responses
 */
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Content Security Policy - Prevents XSS attacks
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://js.stripe.com https://maps.googleapis.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://wa.me https://stripe.com; " +
      "frame-src 'self' https://js.stripe.com; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'",
  );

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Clickjacking protection
  headers.set("X-Frame-Options", "SAMEORIGIN");

  // Referrer Policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Strict Transport Security (HSTS) - Forces HTTPS
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Permissions Policy
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");

  // XSS Protection (legacy, but good to have)
  headers.set("X-XSS-Protection", "1; mode=block");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Rate Limiting
 * Prevents brute force attacks and DoS
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts = 5,
  windowMs: number = 15 * 60 * 1000, // 15 minutes
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetTime: now + windowMs };
  }

  if (existing.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: maxAttempts - existing.count,
    resetTime: existing.resetTime,
  };
}

/**
 * Input Validation
 * Prevents SQL Injection and XSS
 */
export function validateInput(
  input: string,
  options: {
    maxLength?: number;
    pattern?: RegExp;
    allowSpecialChars?: boolean;
  } = {},
): { valid: boolean; error?: string; sanitized?: string } {
  const { maxLength = 1000, pattern, allowSpecialChars = false } = options;

  if (!input) {
    return { valid: false, error: "Input cannot be empty" };
  }

  if (typeof input !== "string") {
    return { valid: false, error: "Input must be a string" };
  }

  if (input.length > maxLength) {
    return { valid: false, error: `Input exceeds maximum length of ${maxLength}` };
  }

  if (!allowSpecialChars) {
    // Check for SQL injection patterns
    const sqlInjectionPattern =
      /('|"|--|;|\/\*|\*\/|xp_|sp_|\bexec\b|\bexecute\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b)/gi;
    if (sqlInjectionPattern.test(input)) {
      return { valid: false, error: "Input contains invalid characters" };
    }
  }

  // Check for XSS patterns
  const xssPattern = /<script|<iframe|javascript:|onerror=|onload=/gi;
  if (xssPattern.test(input)) {
    return { valid: false, error: "Input contains malicious content" };
  }

  // Custom pattern check
  if (pattern && !pattern.test(input)) {
    return { valid: false, error: "Input format is invalid" };
  }

  // Sanitize output
  const sanitized = input.replace(/[<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] || char;
  });

  return { valid: true, sanitized };
}

/**
 * CSRF Token Generation and Validation
 */
export function generateCSRFToken(): string {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  csrfTokenStore.add(token);
  return token;
}

export function validateCSRFToken(token: string): boolean {
  if (csrfTokenStore.has(token)) {
    csrfTokenStore.delete(token); // One-time use
    return true;
  }
  return false;
}

/**
 * CORS Configuration
 */
export function getCORSHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    "https://www.sparklingsilver.in",
    "https://sparklingsilver.in",
    "https://sparklingsilver.lovable.app",
    "http://localhost:8080",
    "http://localhost:5173",
  ];

  const isAllowed = !!origin && allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : "https://www.sparklingsilver.in",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Sanitize Error Messages
 * Don't leak sensitive information in error responses
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (process.env["NODE_ENV"] === "production") {
      return "An error occurred processing your request";
    }
    return error.message;
  }
  return "An unexpected error occurred";
}

/**
 * Create a secure response with proper headers
 */
export function createSecureResponse(
  data: unknown,
  options: {
    status?: number;
    contentType?: string;
    origin?: string;
  } = {},
): Response {
  const { status = 200, contentType = "application/json", origin } = options;

  const response = new Response(
    contentType === "application/json" ? JSON.stringify(data) : String(data),
    {
      status,
      headers: {
        "Content-Type": contentType,
        ...getCORSHeaders(origin),
      },
    },
  );

  return addSecurityHeaders(response);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && email.length <= 255;
}

/**
 * Validate password strength
 * Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true };
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return request.headers.get("cf-connecting-ip") || "unknown";
}

export default {
  addSecurityHeaders,
  checkRateLimit,
  validateInput,
  generateCSRFToken,
  validateCSRFToken,
  getCORSHeaders,
  sanitizeErrorMessage,
  createSecureResponse,
  validateEmail,
  validatePasswordStrength,
  getClientIP,
};
