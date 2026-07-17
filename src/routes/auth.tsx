import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { submitPasswordResetRequest } from "@/lib/users.functions";
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
      { title: "Sign in — Sparkling Silver LLP" },
      { name: "description", content: "Sign in to your Sparkling Silver buyer account. Accounts are created by admin — contact us if you don't have one yet." },
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
        <div className="rounded-md border border-white/15 bg-white/[0.03] p-3 text-[12px] text-white/80">
          <p>We'll notify the admin to reset your password. Make sure the email above is your registered address.</p>
          <button type="button" onClick={onForgotSubmit} className="mt-2 rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/15">
            Send request to admin
          </button>
        </div>
      )}

      <button type="submit" disabled={loading} style={silverStyle} className={silverBtn}>
        {loading ? "Signing in…" : (<>Login <ArrowRight className="h-4 w-4" /></>)}
      </button>
    </form>
  );
}
