import { MessageCircle } from "lucide-react";

export function WhatsAppFab({ message = "Hi Sparkling Jewellers, I'd like to know more." }: { message?: string }) {
  const url = `https://wa.me/919999999999?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-24 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
