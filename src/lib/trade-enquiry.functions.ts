import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const tradeEnquirySchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactPerson: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(20),
  city: z.string().trim().min(2).max(80),
  businessType: z.enum([
    "jewelry_retail",
    "online_retailer",
    "distributor",
    "other",
  ]),
  message: z.string().trim().max(500).optional().or(z.literal("")),
  consent: z.literal(true),
});

export type TradeEnquiryInput = z.infer<typeof tradeEnquirySchema>;

/**
 * Public endpoint: submits a trade-account enquiry from the pre-login screen.
 * Uses the publishable (anon) key, so the RLS insert policy applies.
 */
export const submitTradeEnquiry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tradeEnquirySchema.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const url = process.env["SUPABASE_URL"]!;
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { error } = await supabase.from("trade_enquiries").insert({
      business_name: data.businessName,
      contact_person: data.contactPerson,
      email: data.email,
      phone: data.phone,
      city: data.city,
      business_type: data.businessType,
      message: data.message || null,
      consent: true,
    });

    if (error) throw new Error("Could not submit enquiry");
    return { success: true as const };
  });
