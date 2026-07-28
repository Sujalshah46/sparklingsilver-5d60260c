import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { Building2, User as UserIcon, Phone, Mail, MapPin, FileText, StickyNote, ArrowRight } from "lucide-react";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const inputBase =
  "h-11 w-full rounded-md border bg-transparent px-3 text-[14px] text-white placeholder:text-white/45 outline-none transition";
const areaBase =
  "min-h-[72px] w-full rounded-md border bg-transparent px-3 py-2 text-[14px] text-white placeholder:text-white/45 outline-none transition";
const borderOk = "border-white/20 focus:border-white/60";
const borderErr = "border-red-400/70 focus:border-red-300";
const silverBtn =
  "group relative flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[14px] font-semibold text-[#0b2a20] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,0,0,0.35)] transition disabled:opacity-60 hover:brightness-105 disabled:cursor-not-allowed";
const silverStyle: React.CSSProperties = {
  backgroundImage: "linear-gradient(180deg,#f6f7f8 0%,#dfe2e6 45%,#b7bdc4 55%,#e8ebee 100%)",
};

function Row({
  icon,
  label,
  required = true,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-white">
        <span className="text-white/70">{icon}</span>
        {label} {required && <span className="text-white/50">*</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-red-300">{error}</p>}
    </label>
  );
}

const EXEMPT_PREFIXES = ["/auth", "/reset-password", "/api/", "/change-password"];

export function OnboardingGate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const [userId, setUserId] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const check = async (user: User) => {
    const pathname = window.location.pathname;
    if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return;

    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (role) return;

    const { data: p } = await supabase
      .from("profiles")
      .select("business_name, contact_person, mobile, email, delivery_address, gstin, additional_remarks, profile_completed")
      .eq("id", user.id)
      .maybeSingle();
    if (!p || p.profile_completed) return;

    setUserId(user.id);
    setBusinessName(p?.business_name ?? "");
    setContactPerson(p?.contact_person ?? "");
    setMobile(p?.mobile ?? "");
    setEmail(p?.email ?? user.email ?? "");
    setDeliveryAddress(p?.delivery_address ?? "");
    setGstin(p?.gstin ?? "");
    setRemarks(p?.additional_remarks ?? "");
    setOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) await check(data.user);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setOpen(false);
        return;
      }
      // Reopen on fresh login, restored session after refresh, token refresh, or user updates.
      if (
        (event === "SIGNED_IN" ||
          event === "USER_UPDATED" ||
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        // Never await Supabase calls inside the auth callback — it deadlocks the
        // client's internal lock. Defer to a microtask-free tick instead.
        const user = session.user;
        setTimeout(() => {
          if (!cancelled) check(user);
        }, 0);
      }
    });

    // Re-check when the user navigates away from an exempt path (e.g. /auth → /).
    // The router uses history.pushState, which fires no event, so subscribe to
    // the router's own location instead of non-existent "pushstate" events.
    const onNav = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user && !openRef.current) check(data.user);
      });
    };
    const unsubRouter = router.subscribe("onResolved", onNav);
    window.addEventListener("popstate", onNav);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      unsubRouter();
      window.removeEventListener("popstate", onNav);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!businessName.trim()) e.businessName = "Business Name is required";
    if (!contactPerson.trim()) e.contactPerson = "Person Name is required";
    if (!mobile.trim()) e.mobile = "Mobile Number is required";
    else if (!MOBILE_RE.test(mobile.trim())) e.mobile = "Enter a valid 10-digit Indian mobile number";
    if (!email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";
    if (!deliveryAddress.trim()) e.deliveryAddress = "Delivery Address is required";
    const gst = gstin.trim().toUpperCase();
    if (!gst) e.gstin = "GST Number is required";
    else if (!GSTIN_RE.test(gst)) e.gstin = "Enter a valid 15-character GSTIN (e.g., 27AAPCS1234A1Z5)";
    return e;
  }, [businessName, contactPerson, mobile, email, deliveryAddress, gstin]);

  const isValid = Object.keys(errors).length === 0;
  const showErr = (k: string) => (touched[k] || submitAttempted) && errors[k];

  if (!open || !userId) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!isValid) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: businessName.trim(),
        contact_person: contactPerson.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        delivery_address: deliveryAddress.trim(),
        gstin: gstin.trim().toUpperCase(),
        additional_remarks: remarks.trim() || null,
        profile_completed: true,
      })
      .eq("id", userId);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved. Welcome!");
    setOpen(false);
  };

  const markTouched = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const cls = (k: string, base: string) => `${base} ${showErr(k) ? borderErr : borderOk}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/15 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        style={{
          backgroundColor: "#0b2a20",
          backgroundImage: "radial-gradient(ellipse 90% 60% at 50% 0%, #164636 0%, #0b2a20 55%, #061a13 100%)",
        }}
      >
        <h2 className="text-base font-semibold text-white">Complete your profile</h2>
        <p className="mt-1 text-[12px] text-white/70">
          Please fill in the details below to continue. All fields marked * are required.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-5 space-y-3.5">
          <Row icon={<Building2 className="h-4 w-4" />} label="Business Name" error={showErr("businessName") ? errors.businessName : null}>
            <input
              className={cls("businessName", inputBase)}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onBlur={markTouched("businessName")}
              maxLength={200}
              aria-invalid={!!showErr("businessName")}
            />
          </Row>
          <Row icon={<UserIcon className="h-4 w-4" />} label="Person Name" error={showErr("contactPerson") ? errors.contactPerson : null}>
            <input
              className={cls("contactPerson", inputBase)}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              onBlur={markTouched("contactPerson")}
              maxLength={120}
              aria-invalid={!!showErr("contactPerson")}
            />
          </Row>
          <Row icon={<Phone className="h-4 w-4" />} label="Mobile Number" error={showErr("mobile") ? errors.mobile : null}>
            <input
              className={cls("mobile", inputBase)}
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onBlur={markTouched("mobile")}
              placeholder="10-digit mobile"
              aria-invalid={!!showErr("mobile")}
            />
          </Row>
          <Row icon={<Mail className="h-4 w-4" />} label="Email" error={showErr("email") ? errors.email : null}>
            <input
              className={cls("email", inputBase)}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={markTouched("email")}
              aria-invalid={!!showErr("email")}
            />
          </Row>
          <Row icon={<MapPin className="h-4 w-4" />} label="Delivery Address" error={showErr("deliveryAddress") ? errors.deliveryAddress : null}>
            <textarea
              className={cls("deliveryAddress", areaBase)}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              onBlur={markTouched("deliveryAddress")}
              maxLength={500}
              aria-invalid={!!showErr("deliveryAddress")}
            />
          </Row>
          <Row icon={<FileText className="h-4 w-4" />} label="GST Number" error={showErr("gstin") ? errors.gstin : null}>
            <input
              className={cls("gstin", inputBase)}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
              onBlur={markTouched("gstin")}
              placeholder="15-character GSTIN"
              aria-invalid={!!showErr("gstin")}
            />
          </Row>
          <Row icon={<StickyNote className="h-4 w-4" />} label="Additional Remarks" required={false}>
            <textarea className={`${areaBase} ${borderOk}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} placeholder="Optional" />
          </Row>

          <button type="submit" disabled={loading || !isValid} style={silverStyle} className={silverBtn}>
            {loading ? "Saving…" : (<>Save & Continue <ArrowRight className="h-4 w-4" /></>)}
          </button>
        </form>
      </div>
    </div>
  );
}
