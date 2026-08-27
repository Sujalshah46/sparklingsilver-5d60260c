import { pageTitle, pageDescription, descriptionTags } from "@/lib/seo";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { submitPasswordResetRequest } from "@/lib/users.functions";
import { requestAdminResetCode, confirmAdminResetCode, isAdminEmail } from "@/lib/admin-reset.functions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeRedirect } from "@/lib/site";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, User, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const searchSchema = z.object({
  redirect: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: pageTitle("Sign in") },
      ...descriptionTags("Sign in to your Sparkling Silver buyer account. Accounts are created by admin — contact us if you don't have one yet."),
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  component: AuthPage,
});

const pageBg: React.CSSProperties = {
  backgroundColor: "#0b2a20",
  backgroundImage:
    "radial-gradient(ellipse 90% 60% at 50% 0%, #164636 0%, #0b2a20 55%, #061a13 100%)",
};

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const redirect = sanitizeRedirect(search.redirect);
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: redirect, replace: true });
  }, [isAuthenticated, loading, navigate, redirect]);

  return (
    <div className="relative min-h-screen w-full" style={pageBg}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Sparkling Silver" className="h-28 w-auto" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex items-center gap-2 text-white">
            <User className="h-4 w-4" />
            <h1 className="text-sm font-semibold tracking-wide">Sign In</h1>
          </div>
          <SignInForm redirect={redirect} />

          <div className="mt-5 rounded-md border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/70">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>Buyer accounts are created by our admin team. Contact us if you need access.</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-[11px] text-white/70">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-white/25">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            Secure. Private. Trusted.
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/55">
            <a href="/public/company-info" className="underline hover:text-white">Company Info &amp; Trade Enquiry</a>
            <span aria-hidden>·</span>
            <a href="/privacy" className="underline hover:text-white">Privacy Policy</a>
            <span aria-hidden>·</span>
            <a href="/terms" className="underline hover:text-white">Terms of Use</a>
          </div>

        </div>
      </div>
    </div>
  );
}

const silverBtn =
  "group relative flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[14px] font-semibold text-[#0b2a20] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,0,0,0.35)] transition disabled:opacity-60 hover:brightness-105";
const silverStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(180deg,#f6f7f8 0%,#dfe2e6 45%,#b7bdc4 55%,#e8ebee 100%)",
};

function Field({ icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60">{icon}</span>
      <input
        {...props}
        className="h-11 w-full rounded-md border border-white/20 bg-transparent pl-10 pr-3 text-[14px] text-white placeholder:text-white/45 outline-none transition focus:border-white/60"
      />
    </div>
  );
}
function PasswordField({ value, onChange, autoComplete, placeholder = "Enter your password" }: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Lock className="h-4 w-4" /></span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-white/20 bg-transparent pl-10 pr-10 text-[14px] text-white placeholder:text-white/45 outline-none transition focus:border-white/60"
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[13px] font-semibold text-white">{children}</div>;
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.82 15.4 3.75 6.94 9.4 6.64c1.17.06 2.03.62 2.73.66 1.06-.21 2.08-.81 3.25-.73 1.37.1 2.41.64 3.09 1.63-2.77 1.68-2.32 5.98.22 7.13-.57 1.5-1.31 2.99-2.64 4.99zM12.03 7.25c-.15-2.35 1.66-4.35 3.98-4.52.29 2.58-2.34 4.8-3.98 4.52z" />
    </svg>
  );
}

function AppleSignIn({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        return toast.error(result.error.message || "Apple sign-in failed.");
      }
      if (result.redirected) {
        // Browser will redirect; nothing else to do.
        return;
      }
      // Session was set inline (preview iframe path).
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        return toast.error("Could not complete Apple sign-in.");
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("status, must_change_password")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.status === "inactive") {
        await supabase.auth.signOut();
        return toast.error("Login blocked. Contact Admin.");
      }
      if (profile?.must_change_password) {
        return navigate({ to: "/change-password", replace: true });
      }
      navigate({ to: redirect, replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apple sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      className="group relative flex w-full items-center justify-center gap-2 rounded-md bg-black px-4 py-3 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_6px_16px_rgba(0,0,0,0.35)] transition disabled:opacity-60 hover:bg-neutral-900"
    >
      <AppleLogo className="h-4 w-4" />
      {loading ? "Signing in with Apple…" : "Sign in with Apple"}
    </button>
  );
}

function SignInForm({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const submitReset = useServerFn(submitPasswordResetRequest);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // Blocked user check
    if (data.user) {
      const { data: profile } = await supabase.from("profiles").select("status, must_change_password").eq("id", data.user.id).maybeSingle();
      if (profile?.status === "inactive") {
        await supabase.auth.signOut();
        setLoading(false);
        return toast.error("Login blocked. Contact Admin.");
      }
      setLoading(false);
      toast.success("Welcome back!");
      if (profile?.must_change_password) return navigate({ to: "/change-password", replace: true });
      return navigate({ to: redirect, replace: true });
    }
    setLoading(false);
  };

  const onForgotSubmit = async () => {
    if (!email) return toast.error("Enter your email first.");
    try {
      await submitReset({ data: { email } });
      toast.success("Reset request sent to admin. You'll be contacted shortly.");
      setForgot(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit request");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <FieldLabel>Email</FieldLabel>
        <Field icon={<Mail className="h-4 w-4" />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="Enter your email" />
      </div>
      <div>
        <FieldLabel>Password</FieldLabel>
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="mt-1.5 text-right">
          <button type="button" onClick={() => setForgot((s) => !s)} className="text-[12px] font-medium text-white/80 hover:text-white">
            Forgot Password?
          </button>
        </div>
      </div>

      {forgot && (
        <div className="space-y-3 rounded-md border border-white/15 bg-white/[0.03] p-3 text-[12px] text-white/80">
          <AdminCodeReset email={email} onDone={() => setForgot(false)} />
          <div>
            <p>Buyer account? We'll notify the admin to reset your password.</p>
            <button type="button" onClick={onForgotSubmit} className="mt-2 rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/15">
              Send request to admin
            </button>
          </div>
        </div>
      )}


      <button type="submit" disabled={loading} style={silverStyle} className={silverBtn}>
        {loading ? "Signing in…" : (<>Login <ArrowRight className="h-4 w-4" /></>)}
      </button>

      <div className="flex items-center gap-3 text-white/40">
        <div className="h-px flex-1 bg-white/15" />
        <span className="text-[11px] font-medium uppercase tracking-wider">or</span>
        <div className="h-px flex-1 bg-white/15" />
      </div>

      <AppleSignIn redirect={redirect} />
    </form>
  );
}

function AdminCodeReset({ email, onDone }: { email: string; onDone: () => void }) {
  const requestCode = useServerFn(requestAdminResetCode);
  const confirmCode = useServerFn(confirmAdminResetCode);
  const checkAdmin = useServerFn(isAdminEmail);
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Only reveal the admin reset option once an admin email has been entered.
  useEffect(() => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await checkAdmin({ data: { email: value } });
        if (active) setIsAdmin(!!res?.admin);
      } catch {
        if (active) setIsAdmin(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [email, checkAdmin]);


  const send = async () => {
    if (!email) return toast.error("Enter your admin email first.");
    setBusy(true);
    try {
      await requestCode({ data: { email } });
      setStage("code");
      toast.success("If that's an admin account, a 6-digit code is on its way to that inbox.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await confirmCode({ data: { email, code, new_password: pwd } });
      toast.success("Password updated. Sign in with your new password.");
      setCode("");
      setPwd("");
      setStage("idle");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="border-b border-white/10 pb-3">
      <p className="font-semibold text-white">Admin account?</p>
      <p className="mt-0.5">Get a 6-digit verification code on your registered email and reset your password instantly.</p>
      {stage === "idle" ? (
        <button type="button" disabled={busy} onClick={send} className="mt-2 rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/15 disabled:opacity-60">
          {busy ? "Sending…" : "Email me a code"}
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="6-digit code"
            className="h-10 w-full rounded-md border border-white/20 bg-transparent px-3 text-[14px] tracking-[0.3em] text-white placeholder:tracking-normal placeholder:text-white/45 outline-none focus:border-white/60"
          />
          <PasswordField value={pwd} onChange={setPwd} autoComplete="new-password" placeholder="New password (min 8 chars)" />
          <div className="flex gap-2">
            <button type="button" disabled={busy || code.length !== 6 || pwd.length < 8} onClick={confirm} className="rounded-md border border-white/30 bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/25 disabled:opacity-50">
              {busy ? "Resetting…" : "Reset password"}
            </button>
            <button type="button" disabled={busy} onClick={send} className="rounded-md px-2 py-1.5 text-[12px] text-white/70 underline hover:text-white">
              Resend code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
