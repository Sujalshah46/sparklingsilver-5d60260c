// Server-only helpers for the admin email-code password reset flow.

/** Salted SHA-256 hash so raw codes are never stored. */
export async function hashCode(email: string, code: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "ss-admin-reset";
  const bytes = new TextEncoder().encode(`${email.toLowerCase()}:${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
