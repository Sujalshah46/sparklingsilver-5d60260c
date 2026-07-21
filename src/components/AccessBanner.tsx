import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl } from "@/lib/site";

const KEY = "sj.dismissed.accessBanner";

export function AccessBanner() {
  const [show, setShow] = useState(false);
  const whatsAppHref = whatsappUrl("Hello, I'd like full app access on Sparkling Silver.");
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShow(localStorage.getItem(KEY) !== "1");
  }, []);
  if (!show) return null;
  return (
    <div className="mx-3 mt-3 flex items-start gap-3 rounded-md border border-[#E8E8E8] bg-white p-3.5">
      <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-[#888]" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#1A1A1A]">Limited App Access</p>
        <p className="mt-0.5 text-[12px] leading-snug text-[#666]">
          You currently have limited app access as no products have been assigned to you yet.
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <a
          href={whatsAppHref}
          target={WHATSAPP_LINK_TARGET}
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault();
            openWhatsAppUrl(whatsAppHref);
          }}
          className="rounded-[2px] bg-teal px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-teal-dark"
        >
          Ask for access
        </a>
        <button
          aria-label="Dismiss"
          onClick={() => { localStorage.setItem(KEY, "1"); setShow(false); }}
          className="text-[#999] hover:text-[#555]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
