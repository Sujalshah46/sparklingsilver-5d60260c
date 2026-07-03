import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeRedirect } from "@/lib/site";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, User, UserPlus, Phone, MapPin } from "lucide-react";
import logo from "@/assets/logo.png";

const searchSchema = z.object({
  redirect: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Sparkling Silver LLP" },
      { name: "description", content: "Sign in or create an account to start shopping exquisite jewellery." },
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
    <div className="relative h-[100dvh] w-full overflow-hidden" style={pageBg}>
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-5 pb-3 pt-3">
        {/* Header: logo only */}
        <div className="flex shrink-0 flex-col items-center text-center">
          <img src={logo} alt="Sparkling Silver" className="h-16 w-auto sm:h-20" />
        </div>

        {/* Glass card */}
        <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-white/15 bg-white/[0.04] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <Tabs defaultValue="signin" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid w-full shrink-0 grid-cols-2 border-b border-white/15 bg-transparent p-0 h-auto rounded-none">
              <TabsTrigger
                value="signin"
                className="gap-2 rounded-none border-b-2 border-transparent bg-transparent py-2.5 text-[13px] font-medium text-white/70 shadow-none data-[state=active]:border-white/80 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <User className="h-4 w-4" /> Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="gap-2 rounded-none border-b-2 border-transparent bg-transparent py-2.5 text-[13px] font-medium text-white/70 shadow-none data-[state=active]:border-white/80 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <UserPlus className="h-4 w-4" /> Create Account
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-3 flex-1 overflow-y-auto">
              <SignInForm redirect={redirect} />
            </TabsContent>
            <TabsContent value="signup" className="mt-3 flex-1 overflow-y-auto">
              <SignUpForm redirect={redirect} />
            </TabsContent>
          </Tabs>

          <div className="mt-3 flex shrink-0 items-center justify-center gap-2 border-t border-white/10 pt-3 text-[11px] text-white/70">
            <span className="grid h-5 w-5 place-items-center rounded-full border border-white/25">
              <ShieldCheck className="h-3 w-3" />
            </span>
            Secure. Private. Trusted.
          </div>
        </div>

        <Link
          to="/"
          className="mx-auto mt-2 inline-flex shrink-0 items-center gap-2 text-[12px] font-medium text-white/85 hover:text-white"
        >
          ← Continue browsing as guest
        </Link>
      </div>
    </div>
  );
}

/* ---------- Reusable styled controls ---------- */

const silverBtn =
  "group relative flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-[#0b2a20] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,0,0,0.35)] transition disabled:opacity-60 hover:brightness-105";
const silverStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(180deg,#f6f7f8 0%,#dfe2e6 45%,#b7bdc4 55%,#e8ebee 100%)",
};

function Field({
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
        {icon}
      </span>
      <input
        {...props}
        className="h-9 w-full rounded-md border border-white/20 bg-transparent pl-9 pr-3 text-[13px] text-white placeholder:text-white/45 outline-none transition focus:border-white/60"
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  autoComplete,
  placeholder = "Enter your password",
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
        <Lock className="h-4 w-4" />
      </span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-white/20 bg-transparent pl-9 pr-9 text-[13px] text-white placeholder:text-white/45 outline-none transition focus:border-white/60"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[12px] font-semibold text-white">{children}</div>;
}

function OrDivider() {
  return (
    <div className="my-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/20" />
      <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 text-[10px] font-semibold tracking-wider text-white/75">
        OR
      </span>
      <div className="h-px flex-1 bg-white/20" />
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      style={silverStyle}
      className={silverBtn}
      onClick={async () => {
        setLoading(true);
        const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
        if (result.error) {
          toast.error("Google sign-in failed. Please try again.");
          setLoading(false);
          return;
        }
        if (result.redirected) return;
        toast.success("Welcome to Sparkling!");
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="#EA4335" d="M12 11v3.2h4.4c-.2 1.1-1.4 3.2-4.4 3.2-2.6 0-4.8-2.2-4.8-4.9s2.1-4.9 4.8-4.9c1.5 0 2.5.6 3.1 1.2l2.1-2C15.9 5.6 14.1 5 12 5c-3.9 0-7 3.1-7 7s3.1 7 7 7c4 0 6.7-2.8 6.7-6.8 0-.5-.1-.8-.1-1.2H12z"/>
      </svg>
      Continue with Google
    </button>
  );
}

/* ---------- Forms ---------- */

function SignInForm({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: redirect, replace: true });
  };

  const onForgot = async () => {
    if (!email) return toast.error("Enter your email first, then tap Forgot Password.");
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent.");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <GoogleButton />
      <OrDivider />
      <div>
        <FieldLabel>Email</FieldLabel>
        <Field
          icon={<Mail className="h-4 w-4" />}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="Enter your email"
        />
      </div>
      <div>
        <FieldLabel>Password</FieldLabel>
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="mt-1.5 text-right">
          <button
            type="button"
            onClick={onForgot}
            disabled={resetting}
            className="text-[12px] font-medium text-white/80 hover:text-white"
          >
            {resetting ? "Sending…" : "Forgot Password?"}
          </button>
        </div>
      </div>
      <button type="submit" disabled={loading} style={silverStyle} className={silverBtn}>
        {loading ? "Signing in…" : (<>Sign In <ArrowRight className="h-4 w-4" /></>)}
      </button>
    </form>
  );
}

function SignUpForm({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", mobile: "", city: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: form.full_name },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (data.user && data.session) {
      await supabase.from("profiles").update({ full_name: form.full_name, mobile: form.mobile, city: form.city }).eq("id", data.user.id);
      setLoading(false);
      toast.success("Welcome to Sparkling Silver!");
      navigate({ to: redirect, replace: true });
    } else {
      setLoading(false);
      toast.success("Check your email to confirm your account.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <GoogleButton />
      <OrDivider />
      <div>
        <FieldLabel>Full name</FieldLabel>
        <Field
          icon={<User className="h-4 w-4" />}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
          maxLength={100}
          placeholder="Your name"
        />
      </div>
      <div>
        <FieldLabel>Email</FieldLabel>
        <Field
          icon={<Mail className="h-4 w-4" />}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          maxLength={255}
          placeholder="Enter your email"
        />
      </div>
      <div>
        <FieldLabel>Mobile</FieldLabel>
        <Field
          icon={<Phone className="h-4 w-4" />}
          type="tel"
          inputMode="tel"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          maxLength={15}
          placeholder="Mobile number"
        />
      </div>
      <div>
        <FieldLabel>City</FieldLabel>
        <Field
          icon={<MapPin className="h-4 w-4" />}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          maxLength={80}
          placeholder="City"
        />
      </div>
      <div>
        <FieldLabel>Password</FieldLabel>
        <PasswordField
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          autoComplete="new-password"
          placeholder="Create a password"
        />
      </div>
      <button type="submit" disabled={loading} style={silverStyle} className={silverBtn}>
        {loading ? "Creating…" : (<>Create Account <ArrowRight className="h-4 w-4" /></>)}
      </button>
    </form>
  );
}
