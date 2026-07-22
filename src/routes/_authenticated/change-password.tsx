import { pageTitle } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { changeOwnPassword } from "@/lib/users.functions";
import { toast } from "sonner";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({ meta: [{ title: "Change Password" }] }),
  component: ChangePasswordPage,
});

const pageBg: React.CSSProperties = {
  backgroundColor: "#0b2a20",
  backgroundImage: "radial-gradient(ellipse 90% 60% at 50% 0%, #164636 0%, #0b2a20 55%, #061a13 100%)",
};
const silverBtn = "group relative flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[14px] font-semibold text-[#0b2a20] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,0,0,0.35)] transition disabled:opacity-60 hover:brightness-105";
const silverStyle: React.CSSProperties = { backgroundImage: "linear-gradient(180deg,#f6f7f8 0%,#dfe2e6 45%,#b7bdc4 55%,#e8ebee 100%)" };

function ChangePasswordPage() {
  const navigate = useNavigate();
  const change = useServerFn(changeOwnPassword);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await change({ data: { new_password: pw } });
      toast.success("Password updated. Welcome!");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full" style={pageBg}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Sparkling Silver" className="h-24 w-auto" />
        </div>
        <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="mb-4">
            <h1 className="text-sm font-semibold text-white">Set a new password</h1>
            <p className="mt-1 text-[12px] text-white/70">First-time login — please set your own password to continue.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <PwField value={pw} onChange={setPw} placeholder="New password (min 8 chars)" />
            <PwField value={confirm} onChange={setConfirm} placeholder="Confirm password" />
            <button type="submit" disabled={loading} style={silverStyle} className={silverBtn}>
              {loading ? "Saving…" : (<>Save & Continue <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>
          <div className="mt-4 flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-[11px] text-white/70">
            <ShieldCheck className="h-3.5 w-3.5" /> Your password is encrypted end-to-end.
          </div>
        </div>
      </div>
    </div>
  );
}

function PwField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Lock className="h-4 w-4" /></span>
      <input type="password" value={value} onChange={(e) => onChange(e.target.value)} required minLength={8} placeholder={placeholder}
        className="h-11 w-full rounded-md border border-white/20 bg-transparent pl-10 pr-3 text-[14px] text-white placeholder:text-white/45 outline-none transition focus:border-white/60" />
    </div>
  );
}
