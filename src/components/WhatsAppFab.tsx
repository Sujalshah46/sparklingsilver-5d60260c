import { whatsappUrl, WHATSAPP_DEFAULT_MESSAGE, WHATSAPP_LINK_TARGET, openWhatsAppUrl } from "@/lib/site";
import { trackWhatsAppInquiry } from "@/lib/analytics";

export function WhatsAppFab({ message = WHATSAPP_DEFAULT_MESSAGE }: { message?: string }) {
  const url = whatsappUrl(message);
  return (
    <a
      href={url}
      target={WHATSAPP_LINK_TARGET}
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault();
        trackWhatsAppInquiry("floating_fab", { message });
        openWhatsAppUrl(url);
      }}
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="group fixed right-3 z-40 grid place-items-center rounded-full text-white shadow-[0_6px_18px_rgba(37,211,102,0.45)] ring-1 ring-black/10 transition-all duration-200 hover:scale-105 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        height: 52,
        width: 52,
        bottom: "calc(env(safe-area-inset-bottom) + 66px)",
        background: "linear-gradient(180deg, #25D366 0%, #1EBE5D 100%)",
      }}
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.708.888.66 0 1.876-.387 2.206-1.02.13-.26.155-.518.155-.79 0-.59-2.32-1.205-2.32-1.205zM16.115 0C7.246 0 .046 7.2.046 16.07c0 2.66.66 5.275 1.917 7.62L0 32l8.5-2.217a16.083 16.083 0 0 0 7.615 1.936c8.87 0 16.07-7.2 16.07-16.07S24.985 0 16.115 0z" />
      </svg>
    </a>
  );
}
