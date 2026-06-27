// Shared error helpers — safe for client and server bundles.
// Centralizes the "show me a sensible message" logic so toasts and logs are consistent.
import { ZodError } from "zod";

/**
 * Coerce an unknown thrown value into a human-readable message.
 * Handles Zod errors (first-issue path + message), Error, Supabase PostgrestError
 * shapes, plain strings, and unknowns. Falls back to `fallback`.
 */
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err == null) return fallback;
  if (typeof err === "string") return err || fallback;

  if (err instanceof ZodError) {
    const first = err.issues[0];
    if (!first) return fallback;
    const path = first.path.filter((p) => p !== "").join(".");
    return path ? `${path}: ${first.message}` : first.message;
  }

  if (err instanceof Error) return err.message || fallback;

  if (typeof err === "object") {
    const anyErr = err as { message?: unknown; error_description?: unknown; hint?: unknown };
    if (typeof anyErr.message === "string" && anyErr.message) return anyErr.message;
    if (typeof anyErr.error_description === "string" && anyErr.error_description) {
      return anyErr.error_description;
    }
    if (typeof anyErr.hint === "string" && anyErr.hint) return anyErr.hint;
  }

  return fallback;
}

/**
 * `true` when a server function rejected the request because the user is not
 * signed in. UI can suppress its own error toast and route the user to /auth.
 */
export function isAuthError(err: unknown): boolean {
  const msg = getErrorMessage(err, "").toLowerCase();
  return msg.startsWith("unauthorized") || msg === "auth" || msg.includes("no authorization header");
}

/** `true` when the server rejected because the caller is not an admin. */
export function isForbiddenError(err: unknown): boolean {
  return getErrorMessage(err, "").toLowerCase().includes("forbidden");
}
