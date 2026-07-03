import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Mail, Lock, Eye, EyeOff, User, UserPlus, ArrowRight, ShieldCheck, Phone, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeRedirect } from "@/lib/site";
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

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const redirect = sanitizeRedirect(search.redirect);
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: redirect, replace: true });
  }, [isAuthenticated, loading, navigate, redirect]);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #1a5943 0%, #0f3d2e 40%, #071a13 100%)",
      }}
    >
      {/* Ambient light streaks */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.06) 55%, transparent 70%), linear-gradient(200deg, transparent 60%, rgba(255,255,255,0.04) 75%, transparent 90%)",
        }}
      />
      {/* Soft leaf shadow vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(0,0,0,0.55),transparent_60%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-10">
        {/* Hero: logo + wordmark + tagline */}
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Sparkling Silver" className="h-28 w-auto drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]" />
          <div className="mt-4 flex items-center gap-3 text-white">
            <Sparkle />
            <h1
              className="text-2xl font-light tracking-[0.35em]"
              style={{
                backgroundImage:
                  "linear-gradient(180deg,#ffffff 0%,#e6e6e6 45%,#9a9a9a 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              SPARKLING
            </h1>
            <Sparkle />
          </div>
          <h2
            className="mt-1 text-2xl font-light tracking-[0.35em]"
            style={{
              backgroundImage:
                "linear-gradient(180deg,#ffffff 0%,#e6e6e6 45%,#9a9a9a 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            SILVER
          </h2>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/40" />
            <span className="text-white/70">◆</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/40" />
          </div>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.4em] text-white/70">
            Crafting Masterpiece
          </p>
        </div>

        {/* Glass form card */}
        <div className="relative mt-8 rounded-2xl border border-white/15 bg-white/[0.04] p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <Tabs defaultValue="signin" className="flex flex-1 flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-lg bg-transparent p-0 text-white/60">
              <TabsTrigger
                value="signin"
                className="group flex items-center gap-2 rounded-none border-b border-white/10 bg-transparent pb-3 pt-2 text-sm font-medium data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <User className="h-4 w-4" /> Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="group flex items-center gap-2 rounded-none border-b border-white/10 bg-transparent pb-3 pt-2 text-sm font-medium data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <UserPlus className="h-4 w-4" /> Create Account
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="flex-1">
              <SignInForm redirect={redirect} />
            </TabsContent>
            <TabsContent value="signup" className="flex-1">
              <SignUpForm redirect={redirect} />
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-[11px] tracking-wide text-white/60">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-white/20">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            Secure. Private. Trusted.
          </div>
        </div>

        <Link
          to="/"
          className="mt-6 text-center text-xs font-medium text-white/70 hover:text-white"
        >
          ← Continue browsing as guest
        </Link>
      </div>
    </div>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-white/80" fill="currentColor" aria-hidden>
      <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2z" />
    </svg>
  );
}

/* --- Silver metallic button --- */
function SilverButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "group relative inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-md border border-white/40 text-sm font-medium text-neutral-900 shadow-[0_4px_18px_rgba(0,0,0,0.35)] transition active:translate-y-px disabled:opacity-60 " +
        (props.className ?? "")
      }
      style={{
        backgroundImage:
          "linear-gradient(180deg,#fafafa 0%,#dcdcdc 45%,#a8a8a8 55%,#efefef 100%)",
      }}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/50 opacity-0 transition group-hover:translate-x-[400%] group-hover:opacity-100" />
      {children}
    </button>
  );
}

function fieldClass() {
  return "h-11 rounded-md border-white/20 bg-white/[0.03] pl-10 text-white placeholder:text-white/40 focus-visible:ring-white/40";
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
      {children}
    </span>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <SilverButton
      type="button"
      disabled={loading}
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
        <path fill="#EA4335" d="M12 11v3.2h4.4c-.2 1.1-1.4 3.2-4.4 3.2-2.6 0-4.8-2.2-4.8-4.9s2.1-4.9 4.8-4.9c1.5 0 2.5.6 3.1 1.2l2.1-2C15.9 5.6 14.1 5 12 5c-3.9 0-7 3.1-7 7s3.1 7 7 7c4 0 6.7-2.8 6.7-6.8 0-.5-.1-.8-.1-1.2H12z" />
      </svg>
      Continue with Google
    </SilverButton>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/15" />
      <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 text-[10px] font-semibold uppercase tracking-wider text-white/70">
        OR
      </span>
      <div className="h-px flex-1 bg-white/15" />
    </div>
  );
}

function SignInForm({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: redirect, replace: true });
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <GoogleButton />
      <OrDivider />

      <div className="space-y-2">
        <Label htmlFor="signin-email" className="text-white/85">Email</Label>
        <div className="relative">
          <FieldIcon><Mail className="h-4 w-4" /></FieldIcon>
          <Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="Enter your email" className={fieldClass()} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password" className="text-white/85">Password</Label>
        <div className="relative">
          <FieldIcon><Lock className="h-4 w-4" /></FieldIcon>
          <Input id="signin-password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" minLength={6} placeholder="Enter your password" className={fieldClass() + " pr-10"} />
          <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white" aria-label={showPw ? "Hide password" : "Show password"}>
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" className="text-xs text-white/70 hover:text-white">Forgot Password?</button>
        </div>
      </div>

      <SilverButton type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"} <ArrowRight className="h-4 w-4" />
      </SilverButton>
    </form>
  );
}

function SignUpForm({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", mobile: "", city: "" });
  const [showPw, setShowPw] = useState(false);
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
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <GoogleButton />
      <OrDivider />

      <div className="space-y-2">
        <Label htmlFor="su-name" className="text-white/85">Full name</Label>
        <div className="relative">
          <FieldIcon><User className="h-4 w-4" /></FieldIcon>
          <Input id="su-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={100} placeholder="Your full name" className={fieldClass()} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email" className="text-white/85">Email</Label>
        <div className="relative">
          <FieldIcon><Mail className="h-4 w-4" /></FieldIcon>
          <Input id="su-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} placeholder="Enter your email" className={fieldClass()} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-mobile" className="text-white/85">Mobile</Label>
        <div className="relative">
          <FieldIcon><Phone className="h-4 w-4" /></FieldIcon>
          <Input id="su-mobile" type="tel" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={15} placeholder="Your mobile number" className={fieldClass()} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-city" className="text-white/85">City</Label>
        <div className="relative">
          <FieldIcon><MapPin className="h-4 w-4" /></FieldIcon>
          <Input id="su-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={80} placeholder="Your city" className={fieldClass()} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-password" className="text-white/85">Password</Label>
        <div className="relative">
          <FieldIcon><Lock className="h-4 w-4" /></FieldIcon>
          <Input id="su-password" type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} autoComplete="new-password" placeholder="Create a password" className={fieldClass() + " pr-10"} />
          <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white" aria-label={showPw ? "Hide password" : "Show password"}>
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <SilverButton type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create Account"} <ArrowRight className="h-4 w-4" />
      </SilverButton>
    </form>
  );
}
