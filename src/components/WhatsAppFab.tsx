import { whatsappUrl, WHATSAPP_DEFAULT_MESSAGE } from "@/lib/site";

export function WhatsAppFab({ message = WHATSAPP_DEFAULT_MESSAGE }: { message?: string }) {
  const url = whatsappUrl(message);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="group fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] ring-1 ring-black/5 transition-all duration-300 hover:scale-110 hover:bg-[#1ebe5d] hover:shadow-[0_12px_28px_rgba(37,211,102,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 sm:bottom-28 sm:right-6"
    >
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.708.888.66 0 1.876-.387 2.206-1.02.13-.26.155-.518.155-.79 0-.59-2.32-1.205-2.32-1.205zM16.115 0C7.246 0 .046 7.2.046 16.07c0 2.66.66 5.275 1.917 7.62L0 32l8.5-2.217a16.083 16.083 0 0 0 7.615 1.936c8.87 0 16.07-7.2 16.07-16.07S24.985 0 16.115 0zm0 28.864c-2.39 0-4.728-.65-6.776-1.864l-.487-.287-5.04 1.318 1.345-4.918-.315-.5a13.354 13.354 0 0 1-2.05-7.13C2.793 8.6 8.6 2.793 16.115 2.793c3.626 0 7.03 1.418 9.595 3.984a13.5 13.5 0 0 1 3.97 9.595c0 7.515-5.81 13.32-13.565 13.32z" />
      </svg>
      <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-3 py-1.5 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
        Chat with us on WhatsApp
      </span>
    </a>
  );
}
