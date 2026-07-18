import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl } from "@/lib/site";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(15),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(1000),
});

const CONTACT_TITLE = "Contact Arika Multijewel Works — Visit, Call, WhatsApp";
const CONTACT_DESC = "Visit our Singur, Hooghly factory or reach us on +91 93306 15237 (Factory) / +91 85858 31729 (Accounts). Email arikafactory@gmail.com.";


export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: CONTACT_TITLE },
      { name: "description", content: CONTACT_DESC },
      { property: "og:title", content: CONTACT_TITLE },
      { property: "og:description", content: CONTACT_DESC },
      { property: "og:url", content: "https://sparkling-jewellers-llp.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://sparkling-jewellers-llp.lovable.app/contact" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "JewelryStore",
          name: "Arika Multijewel Works",
          url: "https://sparkling-jewellers-llp.lovable.app/contact",
          telephone: "+91-93306-15237",
          email: "arikafactory@gmail.com",
          address: {
            "@type": "PostalAddress",
            streetAddress: "DAG No-390, Mouza No-50, Ratanpur Main Road, Singur",
            addressLocality: "Ratanpur, Hooghly",
            postalCode: "712409",
            addressRegion: "WB",
            addressCountry: "IN",
          },

        }),
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const whatsAppHref = whatsappUrl();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error("Please fill in all required fields correctly.");
    setLoading(true);
    const { error } = await supabase.from("enquiries").insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      message: parsed.data.message,
    });
    setLoading(false);
    if (error) return toast.error("Could not send. Try again.");
    toast.success("Message sent. We'll be in touch soon!");
    setForm({ name: "", phone: "", email: "", message: "" });
  };

  return (
    <MobileShell title="Contact">
      <div className="space-y-6 p-4">
        <h1 className="font-serif text-2xl font-bold">Get in Touch</h1>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-serif text-base font-semibold">Visit Our Factory</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" />
              <div>
                <div className="font-medium">Arika Multijewel Works</div>
                <div className="text-muted-foreground">Ground Floor, DAG No-390, Mouza No-50,<br />Ratanpur Main Road, Singur,<br />Ratanpur, Hooghly, West Bengal – 712409</div>
                <div className="mt-1 text-xs text-muted-foreground">GST: 19CMLPS4598G1Z5</div>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Factory (Sapnil &amp; Kuldeep)</div>
              <div className="mt-1 flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" /><a href="tel:+919330615237" className="hover:underline">+91 93306 15237</a></div>
              <div className="mt-1 flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" /><a href="mailto:arikafactory@gmail.com" className="hover:underline break-all">arikafactory@gmail.com</a></div>
            </div>
            <div className="border-t border-border pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accounts (Sunil)</div>
              <div className="mt-1 flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" /><a href="tel:+918585831729" className="hover:underline">+91 85858 31729</a></div>
              <div className="mt-1 flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" /><a href="mailto:arikamultijewel@gmail.com" className="hover:underline break-all">arikamultijewel@gmail.com</a></div>
            </div>
          </div>

          <Button asChild className="mt-4 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white">
            <a
              href={whatsAppHref}
              target={WHATSAPP_LINK_TARGET}
              rel="noopener noreferrer"
              onClick={(event) => {
                event.preventDefault();
                openWhatsAppUrl(whatsAppHref);
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" /> Chat on WhatsApp
            </a>
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-serif text-base font-semibold">Send us a Message</h2>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={15} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email (optional)</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-msg">Message</Label>
              <Textarea id="c-msg" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send Message"}
            </Button>
          </form>
        </section>
      </div>
    </MobileShell>
  );
}
