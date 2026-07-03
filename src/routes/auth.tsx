import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
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
      className="min-h-screen"
      style={{ backgroundImage: "radial-gradient(ellipse at center, #1a5943 0%, #0f3d2e 55%, #082418 100%)" }}
    >

      <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-10 text-center">
        <img src={logo} alt="Sparkling Silver" className="h-32 w-auto" />
      </div>

      <div className="mx-auto flex max-w-md flex-col px-6 pb-10 pt-6">
        <div className="rounded-lg border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
          <Tabs defaultValue="signin" className="flex flex-1 flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-black/25 border border-white/10 p-0 h-10">
              <TabsTrigger
                value="signin"
                className="rounded-none text-white/70 data-[state=active]:bg-white data-[state=active]:text-[#0f3d2e] data-[state=active]:shadow-none"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-none text-white/70 data-[state=active]:bg-white data-[state=active]:text-[#0f3d2e] data-[state=active]:shadow-none"
              >
                Create Account
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="flex-1">
              <SignInForm redirect={redirect} />
            </TabsContent>
            <TabsContent value="signup" className="flex-1">
              <SignUpForm redirect={redirect} />
            </TabsContent>
          </Tabs>
        </div>

        <Link to="/" className="mt-6 text-center text-xs font-medium text-white/70 hover:text-white">
          ← Continue browsing as guest
        </Link>
      </div>


    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
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
      <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
        <path fill="#EA4335" d="M12 11v3.2h4.4c-.2 1.1-1.4 3.2-4.4 3.2-2.6 0-4.8-2.2-4.8-4.9s2.1-4.9 4.8-4.9c1.5 0 2.5.6 3.1 1.2l2.1-2C15.9 5.6 14.1 5 12 5c-3.9 0-7 3.1-7 7s3.1 7 7 7c4 0 6.7-2.8 6.7-6.8 0-.5-.1-.8-.1-1.2H12z"/>
      </svg>
      Continue with Google
    </Button>
  );
}

function SignInForm({ redirect }: { redirect: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" minLength={6} />
      </div>
      <Button
        type="submit"
        className="w-full border-0 text-white hover:brightness-110"
        style={{ backgroundImage: "radial-gradient(ellipse at center, #1a5943 0%, #0f3d2e 55%, #082418 100%)" }}
        disabled={loading}
      >
        {loading ? "Signing in…" : "Sign In"}
      </Button>

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
    // Only attempt profile update when a session exists — otherwise (email
    // confirmation required) RLS blocks the write and it silently fails.
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
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-name">Full name</Label>
        <Input id="su-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-mobile">Mobile</Label>
        <Input id="su-mobile" type="tel" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} maxLength={15} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-city">City</Label>
        <Input id="su-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-password">Password</Label>
        <Input id="su-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating…" : "Create Account"}
      </Button>
    </form>
  );
}
