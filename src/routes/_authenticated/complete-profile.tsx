import { pageTitle } from "@/lib/seo";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Building2, User, Phone, Mail, MapPin, FileText, StickyNote } from "lucide-react";
import logo from "@/assets/logo.png";
import { sanitizeRedirect } from "@/lib/site";

const searchSchema = z.object({
  redirect: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/_authenticated/complete-profile")({
  head: () => ({ meta: [{ title: pageTitle("Complete your profile") }] }),
  validateSearch: zodValidator(searchSchema),
  component: CompleteProfilePage,
});

const pageBg: React.CSSProperties = {
  backgroundColor: "#0b2a20",
  backgroundImage: "radial-gradient(ellipse 90% 60% at 50% 0%, #164636 0%, #0b2a20 55%, #061a13 100%)",
};
const silverBtn =
  "group relative flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[14px] font-semibold text-[#0b2a20] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,0,0,0.35)] transition disabled:opacity-60 hover:brightness-105";
const silverStyle: React.CSSProperties = {
  backgroundImage: "linear-gradient(180deg,#f6f7f8 0%,#dfe2e6 45%,#b7bdc4 55%,#e8ebee 100%)",
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-white">
        <span className="text-white/70">{icon}</span>
        {label} <span className="text-white/50">*</span>
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "h-11 w-full rounded-md border border-white/20 bg-transparent px-3 text-[14px] text-white placeholder:text-white/45 outline-none transition focus:border-white/60";
const areaCls =
  "min-h-[80px] w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-[14px] text-white placeholder:text-white/45 outline-none transition focus:border-white/60";

function CompleteProfilePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/complete-profile" });
  const redirect = sanitizeRedirect(search.redirect);

  const [businessName, setBusinessName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("business_name, contact_person, mobile, email, delivery_address, gstin, additional_remarks, profile_completed")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p) {
        if (p.profile_completed) {
          navigate({ to: redirect, replace: true });
          return;
        }
        setBusinessName(p.business_name ?? "");
        setContactPerson(p.contact_person ?? "");
        setMobile(p.mobile ?? "");
        setEmail(p.email ?? data.user.email ?? "");
        setDeliveryAddress(p.delivery_address ?? "");
        setGstin(p.gstin ?? "");
        setRemarks(p.additional_remarks ?? "");
      }
    })();
  }, [navigate, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!businessName.trim()) return toast.error("Business Name is required");
    if (!contactPerson.trim()) return toast.error("Person Name is required");
    if (!MOBILE_RE.test(mobile.trim())) return toast.error("Enter a valid 10-digit mobile number");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Enter a valid email");
    if (!deliveryAddress.trim()) return toast.error("Delivery Address is required");
    const gst = gstin.trim().toUpperCase();
    if (!GSTIN_RE.test(gst)) return toast.error("Enter a valid 15-character GSTIN");

    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: businessName.trim(),
        contact_person: contactPerson.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        delivery_address: deliveryAddress.trim(),
        gstin: gst,
        additional_remarks: remarks.trim() || null,
        profile_completed: true,
      })
      .eq("id", userId);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved. Welcome!");
    navigate({ to: redirect, replace: true });
  };

  return (
    <div className="relative min-h-screen w-full" style={pageBg}>
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 pb-10 pt-8">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Sparkling Silver" className="h-24 w-auto" />
        </div>
        <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <h1 className="text-sm font-semibold text-white">Complete your profile</h1>
          <p className="mt-1 text-[12px] text-white/70">
            Please fill in the details below to continue. All fields marked * are required.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Row icon={<Building2 className="h-4 w-4" />} label="Business Name">
              <input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={200} required />
            </Row>
            <Row icon={<User className="h-4 w-4" />} label="Person Name">
              <input className={inputCls} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} maxLength={120} required />
            </Row>
            <Row icon={<Phone className="h-4 w-4" />} label="Mobile Number">
              <input className={inputCls} inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" required />
            </Row>
            <Row icon={<Mail className="h-4 w-4" />} label="Email">
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Row>
            <Row icon={<MapPin className="h-4 w-4" />} label="Delivery Address">
              <textarea className={areaCls} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} maxLength={500} required />
            </Row>
            <Row icon={<FileText className="h-4 w-4" />} label="GST Number">
              <input className={inputCls} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))} placeholder="15-character GSTIN" required />
            </Row>
            <label className="block">
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-white">
                <span className="text-white/70"><StickyNote className="h-4 w-4" /></span>
                Additional Remarks
              </div>
              <textarea className={areaCls} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} placeholder="Optional" />
            </label>

            <button type="submit" disabled={loading} style={silverStyle} className={silverBtn}>
              {loading ? "Saving…" : (<>Save & Continue <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
