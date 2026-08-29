import { Link } from "@tanstack/react-router";
import { Clock, AlertTriangle } from "lucide-react";

/**
 * Inline notice for cart/checkout when the signed-in buyer's profile status is
 * 'pending' or 'rejected'. Explains why ordering is unavailable. Rendering
 * decisions (which statuses to show for) live with the caller via the status
 * prop from useApproval().
 */
export function OrderingStatusNotice({ status }: { status: string | null }) {
  if (status !== "pending" && status !== "rejected") return null;
  const rejected = status === "rejected";

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        rejected ? "border-destructive/40 bg-destructive/5" : "border-gold/40 bg-card"
      }`}
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/50 bg-background">
        {rejected ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <Clock className="h-4 w-4 text-gold" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground">
          {rejected ? "Your account was not approved" : "Your account is under review"}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {rejected
            ? "Ordering isn't available on this account. You can review your cart and save your selections — please contact our team if you believe this was a mistake."
            : "Ordering will be available once your account is approved. You can review your cart and prepare your selections in the meantime."}
        </p>
        <Link
          to="/contact"
          className="mt-1 inline-block text-[13px] font-semibold text-burgundy underline underline-offset-2"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
