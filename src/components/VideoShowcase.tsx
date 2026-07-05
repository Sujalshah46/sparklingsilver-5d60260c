import { useRef, useState } from "react";
import video8 from "@/assets/sparkling-video-8.mp4.asset.json";

const VIDEOS: { src: string; title?: string }[] = [
  { src: video8.url },
];

export function VideoShowcase() {
  return (
    <section className="pt-6">
      <div className="px-3">
        <p className="section-heading">Watch Our Collections</p>
        <span className="section-underline mt-2" />
      </div>
      <div className="mt-3 flex justify-center gap-3 overflow-x-auto px-3 pb-2 scrollbar-hide snap-x snap-mandatory">
        {VIDEOS.map((v, i) => (
          <VideoCard key={i} src={v.src} />
        ))}
      </div>
    </section>
  );
}

function VideoCard({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); }
    else { el.pause(); setPlaying(false); }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="relative w-[260px] shrink-0 snap-start overflow-hidden rounded-md border border-slate-200 bg-black shadow-sm"
      style={{ aspectRatio: "9 / 16" }}
    >
      <video
        ref={ref}
        src={src}
        className="h-full w-full object-cover"
        playsInline
        loop
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {!playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
            <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[2px] fill-teal-700">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      )}
    </button>
  );
}
