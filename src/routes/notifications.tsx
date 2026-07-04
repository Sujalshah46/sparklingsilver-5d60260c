import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { Bell, Package, Sparkles, Gift } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Sparkling Silver" }] }),
  component: NotificationsPage,
});

const SAMPLE = [
  { icon: Package, t: "Your order SJ241124001 is being processed", h: "Today, 10:30 AM", c: "Order Update" },
  { icon: Sparkles, t: "New Bridal Collection just dropped — explore now", h: "Yesterday", c: "New Arrivals" },
  { icon: Gift, t: "Festive offer: Up to ₹2,000 off on making charges", h: "2 days ago", c: "Offer" },
];

function NotificationsPage() {
  return (
    <MobileShell title="Notifications">
      <div className="p-4">
        <ul className="space-y-2">
          {SAMPLE.map((n, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 text-burgundy">
                <n.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-burgundy">{n.c}</p>
                <p className="mt-0.5 text-sm">{n.t}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{n.h}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Bell className="h-3.5 w-3.5" /> You're all caught up.
        </p>
      </div>
    </MobileShell>
  );
}
