import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { checkRateLimit, getClientIP } from "./security";

const emailSchema = z.string().trim().email().max(255);

/** Per-IP throttle for the unauthenticated admin-reset endpoints below. */
async function throttleByIP(bucket: string, maxAttempts: number) {
  const request = getRequest();
  const ip = request ? getClientIP(request) : "unknown";
  const { allowed } = await checkRateLimit(`${bucket}:${ip}`, maxAttempts, 15 * 60 * 1000);
  if (!allowed) throw new Error("Too many requests. Please try again later.");
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Generic response so the endpoint never reveals whether an email is an admin.
const GENERIC = { ok: true as const };

/**
 * Lightweight probe so the UI only reveals the admin reset option after an
 * admin email has actually been typed in.
 */
export const isAdminEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }) => {
    // Prevents scripted enumeration of which emails hold the admin role.
    await throttleByIP("admin-email-probe", 20);
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (!prof) return { admin: false as const };
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", prof.id)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: !!role };
  });

/**
 * Step 1 — an admin requests a 6-digit code by email.
 * Only accounts holding the `admin` role get a code; everyone else silently
 * receives the same generic response.
 */
export const requestAdminResetCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data }) => {
    await throttleByIP("admin-reset-request", 10);
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashCode } = await import("./admin-reset.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
    if (!prof) return GENERIC;

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", prof.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return GENERIC;

    // Rate limit: max 5 codes per email per hour.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("admin_reset_codes")
      .select("id", { count: "exact", head: true })
      .ilike("email", email)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Too many code requests. Please try again later.");

    // Invalidate any outstanding codes for this admin.
    await supabaseAdmin
      .from("admin_reset_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", prof.id)
      .is("used_at", null);

    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(buf[0] % 1_000_000).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("admin_reset_codes").insert({
      user_id: prof.id,
      email,
      code_hash: await hashCode(email, code),
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const { sendAdminEmail } = await import("./admin-email.server");
    const sent = await sendAdminEmail({
      to: prof.email ?? email,
      subject: "Your Sparkling Silver admin password reset code",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
          <h2 style="color:#0b2a20;margin:0 0 8px">Admin password reset</h2>
          <p style="color:#444;margin:0 0 16px">Use the verification code below to reset the password for <b>${escapeHtml(prof.email ?? email)}</b>.</p>
          <p style="font-size:30px;letter-spacing:8px;font-weight:700;text-align:center;margin:20px 0;color:#0b2a20">${code}</p>
          <p style="color:#666;font-size:13px">This code expires in 10 minutes and can be used once. If you didn't request it, ignore this email — your password stays unchanged.</p>
        </div>`,
    });
    if (!sent.ok) {
      console.warn("[admin-reset] code email not delivered", sent.error ?? "skipped");
      // Dev-only fallback so the flow stays testable before a sender domain is live.
      if (process.env.NODE_ENV !== "production") console.warn("[admin-reset][dev] code for", email, "=", code);
    }
    return GENERIC;
  });

/**
 * Step 2 — verify the code and set a new password.
 */
export const confirmAdminResetCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: emailSchema,
        code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
        new_password: z.string().min(8, "Password must be at least 8 characters").max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await throttleByIP("admin-reset-confirm", 20);
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashCode } = await import("./admin-reset.server");

    const { data: row } = await supabaseAdmin
      .from("admin_reset_codes")
      .select("id, user_id, code_hash, attempts, expires_at")
      .ilike("email", email)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) throw new Error("Invalid or expired code. Request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired. Request a new one.");
    if (row.attempts >= 5) throw new Error("Too many incorrect attempts. Request a new code.");

    const hash = await hashCode(email, data.code);
    if (hash !== row.code_hash) {
      await supabaseAdmin.from("admin_reset_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Incorrect code.");
    }

    // Re-verify admin role at redemption time.
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", row.user_id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("This reset option is only available for admin accounts.");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_reset_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", row.user_id);
    await supabaseAdmin.from("user_activity_log").insert({
      user_id: row.user_id,
      actor_id: row.user_id,
      action: "admin_self_reset_password",
      meta: { via: "email_code" },
    });

    return { ok: true as const };
  });
