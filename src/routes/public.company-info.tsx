import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, MessageCircle, BadgeCheck, Instagram, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl, INSTAGRAM_URL, HIDDEN_CATEGORY_SLUGS } from "@/lib/site";
import { pageTitle, pageDescription, descriptionTags } from "@/lib/seo";
import { PREMIUM_CATEGORY_IMAGES, categoryPlaceholder } from "@/lib/product-images";
import { submitTradeEnquiry, tradeEnquirySchema } from "@/lib/trade-enquiry.functions";

const TITLE = pageTitle("Company Profile & Trade Account Enquiry");
const DESC = pageDescription(
  "Sparkling Silver is a manufacturer and wholesaler of 925 hallmarked silver, antique and CZ jewellery. See our credentials, showroom details and enquire about a trade account.",
);

export const Route = createFileRoute("/public/company-info")({
  head: () => ({
    meta: [
      { title: TITLE },
      ...descriptionTags(DESC),
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://sparklingsilver.in/public/company-info" },
    ],
    links: [{ rel: "canonical", href: "https://sparklingsilver.in/public/company-info" }],
  }),
  component: CompanyInfoPage,
});

const BUSINESS_TYPES = [
  { value: "jewelry_retail", label: "Jewellery Retail" },
  { value: "online_retailer", label: "Online Retailer" },
  { value: "distributor", label: "Distributor" },
  { value: "other", label: "Other" },
] as const;

const EMAIL = "sparklingsilverjewellery@gmail.com";

function CompanyInfoPage() {
  const send = useServerFn(submitTradeEnquiry);
  const [form, setForm] = useState({
    businessName: "",
    contactPerson: "",
    email: "",
    phone: "",
    city: "",
    businessType: "jewelry_retail",
    message: "",
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["public-company-categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, image_url, product_count, sort_order")
        .order("sort_order", { ascending: true })
        .limit(20);
      return (data ?? []).filter((c) => !HIDDEN_CATEGORY_SLUGS.includes(c.slug)).slice(0, 8);
    },
  });

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = tradeEnquirySchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] =
          key === "consent"
            ? "Please tick the consent checkbox to continue."
            : issue.message === "Invalid email"
              ? "Enter a valid email address."
              : "This field is required.";
      }
      setErrors(next);
      toast.error("Please check the highlighted fields.");
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await send({ data: parsed.data });
      setDone(true);
      setForm({
        businessName: "",
        contactPerson: "",
        email: "",
        phone: "",
        city: "",
        businessType: "jewelry_retail",
        message: "",
        consent: false,
      });
    } catch {
      toast.error(`Something went wrong. Please try again or contact us at ${EMAIL}.`);
    } finally {
      setLoading(false);
    }
  };

  const err = (k: string) => errors[k];
  const inputCls = "h-11 text-base";

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 pb-16 pt-8">
      <header className="text-center">
        <p className="font-serif text-2xl font-semibold tracking-wide">Sparkling Silver</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Handcrafted 925 Silver, Antique &amp; CZ Jewellery — Manufacturer &amp; Wholesaler
        </p>
      </header>

      <section className="mt-8 space-y-3">
        <h1 className="font-serif text-xl font-semibold">Company Profile</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sparkling Silver is a manufacturer and wholesaler of premium handcrafted silver
          jewellery based in Singur, Hooghly, West Bengal. We supply independent jewellery
          retailers, online sellers and distributors across India with exclusive antique and
          CZ designs, custom metalwork and wholesale pricing. Our artisans combine traditional
          Bengali craftsmanship with contemporary design.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-xl font-semibold">Manufacturing Credentials</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            All pieces hallmarked 925 (92.5% silver purity)
          </li>
          <li className="flex gap-2">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            GST registered manufacturer — wholesale &amp; B2B supply only
          </li>
          <li className="flex gap-2">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            In-house design, casting, stone-setting and finishing units
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-xl font-semibold">Showroom &amp; Contact</h2>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <span>Sparkling Silver, Singur, Hooghly, West Bengal 712409, India</span>
          </li>
          <li className="flex gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <a className="underline" href="tel:+919330615237">+91 93306 15237</a>
            <span className="text-muted-foreground">(Factory)</span>
          </li>
          <li className="flex gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <a className="break-all underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </li>
          <li className="flex gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <a
              className="underline"
              href={whatsappUrl()}
              target={WHATSAPP_LINK_TARGET}
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                openWhatsAppUrl(whatsappUrl());
              }}
            >
              WhatsApp us
            </a>
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-xl font-semibold">What We Manufacture</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(categories ?? []).map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl border bg-card">
              <img
                src={PREMIUM_CATEGORY_IMAGES[c.slug] || c.image_url || categoryPlaceholder}
                alt={c.name}
                width={300}
                height={300}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full bg-muted object-cover"
              />
              <div className="p-2">
                <p className="truncate text-sm font-medium">{c.name}</p>
                {typeof c.product_count === "number" && c.product_count > 0 ? (
                  <p className="text-xs text-muted-foreground">{c.product_count} designs</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold">Become Our Retail Partner</h2>
        {done ? (
          <div className="mt-4 flex gap-3 rounded-xl border bg-card p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden="true" />
            <p className="text-sm">
              Thank you! Our team will review your enquiry and contact you within 2 business days.
            </p>
          </div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
            <div>
              <Label htmlFor="businessName">Business name *</Label>
              <Input id="businessName" className={inputCls} value={form.businessName}
                aria-invalid={!!err("businessName")} aria-describedby={err("businessName") ? "businessName-err" : undefined}
                onChange={(e) => set("businessName")(e.target.value)} />
              {err("businessName") && <p id="businessName-err" className="mt-1 text-xs text-destructive">{err("businessName")}</p>}
            </div>
            <div>
              <Label htmlFor="contactPerson">Contact person *</Label>
              <Input id="contactPerson" className={inputCls} value={form.contactPerson}
                aria-invalid={!!err("contactPerson")} aria-describedby={err("contactPerson") ? "contactPerson-err" : undefined}
                onChange={(e) => set("contactPerson")(e.target.value)} />
              {err("contactPerson") && <p id="contactPerson-err" className="mt-1 text-xs text-destructive">{err("contactPerson")}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" inputMode="email" className={inputCls} value={form.email}
                aria-invalid={!!err("email")} aria-describedby={err("email") ? "email-err" : undefined}
                onChange={(e) => set("email")(e.target.value)} />
              {err("email") && <p id="email-err" className="mt-1 text-xs text-destructive">{err("email")}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" type="tel" inputMode="tel" className={inputCls} value={form.phone}
                aria-invalid={!!err("phone")} aria-describedby={err("phone") ? "phone-err" : undefined}
                onChange={(e) => set("phone")(e.target.value)} />
              {err("phone") && <p id="phone-err" className="mt-1 text-xs text-destructive">{err("phone")}</p>}
            </div>
            <div>
              <Label htmlFor="city">City *</Label>
              <Input id="city" className={inputCls} value={form.city}
                aria-invalid={!!err("city")} aria-describedby={err("city") ? "city-err" : undefined}
                onChange={(e) => set("city")(e.target.value)} />
              {err("city") && <p id="city-err" className="mt-1 text-xs text-destructive">{err("city")}</p>}
            </div>
            <div>
              <Label htmlFor="businessType">Business type *</Label>
              <select
                id="businessType"
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                value={form.businessType}
                onChange={(e) => set("businessType")(e.target.value)}
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="message">Tell us about your retail business (optional)</Label>
              <Textarea id="message" maxLength={500} className="text-base" value={form.message}
                onChange={(e) => set("message")(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">{form.message.length}/500</p>
            </div>
            <div className="flex items-start gap-3">
              <input
                id="consent"
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-input"
                checked={form.consent}
                aria-invalid={!!err("consent")}
                aria-describedby={err("consent") ? "consent-err" : undefined}
                onChange={(e) => set("consent")(e.target.checked)}
              />
              <div>
                <Label htmlFor="consent" className="text-sm font-normal">
                  I consent to be contacted about wholesale opportunities. *
                </Label>
                {err("consent") && <p id="consent-err" className="mt-1 text-xs text-destructive">{err("consent")}</p>}
              </div>
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "Sending…" : "Send Enquiry"}
            </Button>
          </form>
        )}
      </section>

      <footer className="mt-12 border-t pt-6 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/privacy" className="underline">Privacy Policy</Link>
          <Link to="/terms" className="underline">Terms of Service</Link>
          <Link to="/auth" className="underline">Buyer Login</Link>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            <Instagram className="h-3.5 w-3.5" aria-hidden="true" /> Instagram
          </a>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} Sparkling Silver. All rights reserved.</p>
      </footer>
    </div>
  );
}
