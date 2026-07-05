import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "user";
}
function randomPassword(len = 14) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const low = "abcdefghijkmnpqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%^&*";
  const all = abc + low + num + sym;
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let p = abc[arr[0] % abc.length] + low[arr[1] % low.length] + num[arr[2] % num.length] + sym[arr[3] % sym.length];
  for (let i = 4; i < len; i++) p += all[arr[i] % all.length];
  return p.split("").sort(() => Math.random() - 0.5).join("");
}

const createInput = z.object({
  business_name: z.string().trim().min(1).max(120),
  contact_person: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  mobile: z.string().trim().max(20).optional().nullable(),
  business_type: z.enum(["individual", "wholesale", "retail"]).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Generate unique username
    const base = slugify(data.business_name);
    let username = "";
    for (let i = 1; i < 100; i++) {
      const candidate = `${base}${String(i).padStart(2, "0")}`;
      const { data: exists } = await supabaseAdmin.from("profiles").select("id").eq("username", candidate).maybeSingle();
      if (!exists) { username = candidate; break; }
    }
    if (!username) username = `${base}${Date.now().toString().slice(-4)}`;

    const password = randomPassword(14);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: data.contact_person,
        contact_person: data.contact_person,
        business_name: data.business_name,
        username,
        mobile: data.mobile ?? undefined,
        must_change_password: true,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    // Ensure profile row exists with all fields (handle_new_user trigger already inserts; update fields not covered)
    await supabaseAdmin.from("profiles").update({
      business_name: data.business_name,
      contact_person: data.contact_person,
      username,
      mobile: data.mobile ?? null,
      business_type: (data.business_type ?? "individual") as any,
      status: "active",
      must_change_password: true,
    }).eq("id", created.user.id);

    await supabaseAdmin.from("user_activity_log").insert({
      user_id: created.user.id, actor_id: userId, action: "admin_create_user",
      meta: { email: data.email, username },
    });

    return { ok: true, user_id: created.user.id, username, email: data.email, password };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = randomPassword(14);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.user_id);
    await supabaseAdmin.from("user_activity_log").insert({
      user_id: data.user_id, actor_id: userId, action: "admin_reset_password", meta: {},
    });
    return { ok: true, password };
  });

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    // Optional: sign out the user by banning them briefly
    if (data.status === "inactive") {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "876000h" }).catch(() => {});
    } else {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "none" }).catch(() => {});
    }
    await supabaseAdmin.from("user_activity_log").insert({
      user_id: data.user_id, actor_id: userId, action: `admin_status_${data.status}`, meta: {},
    });
    return { ok: true };
  });

export const adminSendCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    password: z.string().min(6).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("profiles").select("email, username, full_name").eq("id", data.user_id).maybeSingle();
    if (!p?.email) throw new Error("User has no email on file");
    const { sendAdminEmail } = await import("./admin-email.server");
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
        <h2 style="color:#0b2a20">Your Sparkling Silver credentials</h2>
        <p>Hi ${escapeHtml(p.full_name ?? "")}, your account has been created.</p>
        <p><b>Username:</b> ${escapeHtml(p.username ?? "")}<br/><b>Email:</b> ${escapeHtml(p.email ?? "")}<br/><b>Password:</b> <code>${escapeHtml(data.password)}</code></p>
        <p>You'll be asked to set a new password on first login.</p>
      </div>`;
    const r = await sendAdminEmail({ to: p.email, subject: "Your Sparkling Silver credentials", html });
    await supabaseAdmin.from("user_activity_log").insert({
      user_id: data.user_id, actor_id: userId, action: "admin_send_credentials", meta: { ok: r.ok, skipped: r.skipped ?? false },
    });
    return r;
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, business_name, contact_person, email, mobile, status, must_change_password, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListResetRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("password_reset_requests")
      .select("id, email, user_id, status, note, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminResolveResetRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase
      .from("password_reset_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq("id", data.request_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: submit a reset request. No auth required.
export const submitPasswordResetRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    email: z.string().trim().email().max(255),
    note: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    await supabaseAdmin.from("password_reset_requests").insert({
      email: data.email, user_id: prof?.id ?? null, note: data.note ?? null,
    });
    try {
      const { sendAdminEmail } = await import("./admin-email.server");
      await sendAdminEmail({
        subject: "New password reset request",
        html: `<p>A buyer requested a password reset.</p><p><b>Email:</b> ${escapeHtml(data.email)}</p>${data.note ? `<p><b>Note:</b> ${escapeHtml(data.note)}</p>` : ""}<p>Open the admin panel → Users → Reset Requests to handle it.</p>`,
      });
    } catch {}
    return { ok: true };
  });

// Authenticated: change own password + clear must_change_password.
export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ new_password: z.string().min(8).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.new_password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", context.userId);
    await supabaseAdmin.from("user_activity_log").insert({
      user_id: context.userId, actor_id: context.userId, action: "self_change_password", meta: {},
    });
    return { ok: true };
  });
