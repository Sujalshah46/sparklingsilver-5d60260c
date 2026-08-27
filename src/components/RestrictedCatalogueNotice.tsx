import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useApproval } from "@/hooks/use-approval";

/**
 * Shown wherever products are listed. The database only returns featured
 * designs to logged-out or not-yet-approved viewers, so this explains the
 * short list instead of it looking empty or broken.
 */
export function RestrictedCatalogueNotice({ className = "" }: { className?: string }) {
  const { loading, isApproved, isAnonymous } = useApproval();
  if (loading || isApproved) return null;

  return (
    <div
      className={`mx-3 mt-3 flex items-start gap-3 rounded-md border border-gold/40 bg-card p-3 ${className}`}
      role="status"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/50 bg-background">
        <Lock className="h-4 w-4 text-gold" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground">
          {isAnonymous
            ? "Sign in and get approved to view our full catalogue of 900+ designs"
            : "Your account is awaiting approval"}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {isAnonymous
            ? "You’re viewing a small selection of featured pieces. Wholesale rates and ordering unlock once your account is approved."
            : "You’re viewing a small selection of featured pieces. Our team is reviewing your business details — the full catalogue, wholesale rates and ordering unlock once approved."}
        </p>
        {isAnonymous && (
          <Link
            to="/auth"
            search={{ redirect: typeof window === "undefined" ? "/" : window.location.pathname }}
            className="mt-1 inline-block text-[13px] font-semibold text-burgundy underline underline-offset-2"
          >
            Sign in / Register
          </Link>
        )}
      </div>
    </div>
  );
}
