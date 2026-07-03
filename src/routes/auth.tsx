import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Mail, Lock, Eye, EyeOff, User, UserPlus, ShieldCheck, ArrowLeft, ArrowRight, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeRedirect } from "@/lib/site";
import "./auth.css";

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

type Tab = "signin" | "signup";

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const redirect = sanitizeRedirect(search.redirect);
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("signin");

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: redirect, replace: true });
  }, [isAuthenticated, loading, navigate, redirect]);

  return (
    <main className="ss-login-page">
      <div className="ss-bg-light" />
      <div className="ss-leaves ss-leaves-left" />
      <div className="ss-leaves ss-leaves-right" />

      <section className="ss-brand">
        <div className="ss-logo-mark">
          <div className="ss-gem" />
          <div className="ss-ribbon ss-ribbon-a" />
          <div className="ss-ribbon ss-ribbon-b" />
        </div>

        <div className="ss-title-row">
          <span />
          <h1>Sparkling<br />Silver</h1>
          <span />
        </div>
        <div className="ss-diamond-line">
          <span /> <b>✧</b> <span />
        </div>
        <p>Crafting Masterpiece</p>
      </section>

      <section className="ss-card" aria-label="Login form">
        <div className="ss-tabs" role="tablist">
          <button
            className={`ss-tab ${tab === "signin" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "signin"}
            onClick={() => setTab("signin")}
          >
            <User size={22} /> Sign In
          </button>
          <button
            className={`ss-tab ${tab === "signup" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "signup"}
            onClick={() => setTab("signup")}
          >
            <UserPlus size={22} /> Create Account
          </button>
        </div>

        <GoogleButton />

        <div className="ss-or"><span /> <b>OR</b> <span /></div>

        {tab === "signin" ? <SignInForm redirect={redirect} /> : <SignUpForm redirect={redirect} />}

        <div className="ss-trust">
          <span /> <ShieldCheck size={24} /> Secure. Private. Trusted. <span />
        </div>
      </section>

      <Link to="/" className="ss-guest">
        <ArrowLeft size={24} /> Continue browsing as guest
      </Link>
    </main>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      className="ss-google"
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
      <span className="ss-google-g">G</span>
      Continue with Google
    </button>
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
    <form className="ss-form" onSubmit={onSubmit}>
      <label htmlFor="signin-email">Email</label>
      <div className="ss-input-wrap">
        <Mail size={22} />
        <input id="signin-email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>

      <label htmlFor="signin-password">Password</label>
      <div className="ss-input-wrap">
        <Lock size={21} />
        <input id="signin-password" type={showPw ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" minLength={6} />
        <button type="button" className="ss-eye-btn" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
          {showPw ? <EyeOff size={22} className="ss-eye" /> : <Eye size={22} className="ss-eye" />}
        </button>
      </div>

      <a className="ss-forgot" href="#forgot">Forgot Password?</a>

      <button className="ss-submit" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"} <ArrowRight size={28} />
      </button>
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
    <form className="ss-form" onSubmit={onSubmit}>
      <label htmlFor="su-name">Full name</label>
      <div className="ss-input-wrap">
        <User size={22} />
        <input id="su-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={100} placeholder="Your full name" />
      </div>

      <label htmlFor="su-email">Email</label>
      <div className="ss-input-wrap">
        <Mail size={22} />
        <input id="su-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} placeholder="Enter your email" />
      </div>

      <label htmlFor="su-mobile">Mobile</label>
      <div className="ss-input-wrap">
        <Phone size={22} />
        <input id="su-mobile" type="tel" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={15} placeholder="Your mobile number" />
      </div>

      <label htmlFor="su-city">City</label>
      <div className="ss-input-wrap">
        <MapPin size={22} />
        <input id="su-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={80} placeholder="Your city" />
      </div>

      <label htmlFor="su-password">Password</label>
      <div className="ss-input-wrap">
        <Lock size={21} />
        <input id="su-password" type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} autoComplete="new-password" placeholder="Create a password" />
        <button type="button" className="ss-eye-btn" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
          {showPw ? <EyeOff size={22} className="ss-eye" /> : <Eye size={22} className="ss-eye" />}
        </button>
      </div>

      <button className="ss-submit" type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create Account"} <ArrowRight size={28} />
      </button>
    </form>
  );
}
