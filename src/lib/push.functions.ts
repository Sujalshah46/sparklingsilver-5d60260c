import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subInput = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  user_agent: z.string().max(500).optional().nullable(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: data.endpoint,
          user_id: userId,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.user_agent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    // Scope delete to the caller — without user_id filter any signed-in user
    // could wipe another user's push subscription by guessing the endpoint.
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    return { ok: true };
  });


/** Native (Expo) device token registration — used by the iOS/Android wrapper. */
const expoInput = z.object({
  token: z.string().min(10).max(300),
  platform: z.string().max(20).optional().nullable(),
  device_name: z.string().max(120).optional().nullable(),
});

export const saveExpoPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => expoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expo_push_tokens").upsert(
      {
        token: data.token,
        user_id: context.userId,
        platform: data.platform ?? null,
        device_name: data.device_name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeExpoPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("expo_push_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId);
    return { ok: true };
  });
