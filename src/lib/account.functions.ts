import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Buyer-initiated account deletion (App Store Guideline 5.1.1(v) requires an
 * in-app way to start account deletion). Marks the profile deleted, blocks
 * future sign-ins and records the request for the audit log.
 */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ reason: z.string().trim().max(500).optional().nullable() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admins must not be able to lock themselves out of the panel.
    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminRow) {
      throw new Error("Admin accounts cannot be deleted from the app. Contact support.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: "deleted" })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    // Best-effort cleanup of personal shopping data.
    await supabaseAdmin.from("cart_items").delete().eq("user_id", userId);
    await supabaseAdmin.from("wishlist_items").delete().eq("user_id", userId);
    await supabaseAdmin.from("expo_push_tokens").delete().eq("user_id", userId);
    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", userId);

    await supabaseAdmin.auth.admin
      .updateUserById(userId, { ban_duration: "876000h" })
      .catch(() => {});

    await supabaseAdmin.from("user_activity_log").insert({
      user_id: userId,
      actor_id: userId,
      action: "self_delete_account",
      meta: { reason: data.reason ?? null },
    });

    return { ok: true };
  });
