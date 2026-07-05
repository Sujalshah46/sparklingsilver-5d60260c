import { useEffect, useRef, useState } from "react";
import video8 from "@/assets/sparkling-video-8.mp4.asset.json";
import video9 from "@/assets/sparkling-video-9.mp4.asset.json";
import video10 from "@/assets/sparkling-video-10.mp4.asset.json";

const VIDEOS: { src: string; title?: string }[] = [
  { src: video8.url },
  { src: video9.url },
  { src: video10.url },
];

export function VideoShowcase() {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const handleEnded = () => setIndex((i) => (i + 1) % VIDEOS.length);

  return (
    <section className="pt-5">
      <div className="flex flex-col items-center px-6 text-center">
        
        <span className="mb-1 pl-[0.4em] text-[9px] font-semibold uppercase tracking-[0.4em] text-[#2C7A76]">
          Watch
        </span>
        <h2
          className="text-[22px] leading-[1.1] text-slate-900"
          style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', ui-serif, Georgia, serif", fontStyle: "italic" }}
        >
          Our <span className="font-light">Collections</span>
        </h2>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="h-px w-6 bg-slate-300" />
          <div className="h-1.5 w-1.5 rotate-45 border border-[#2C7A76]" />
          <div className="h-px w-6 bg-slate-300" />
        </div>
      </div>
      <div className="mt-3 flex justify-center px-3 pb-2">
        <VideoCard
          key={index}
          src={VIDEOS[index].src}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onEnded={handleEnded}
        />
      </div>
      {VIDEOS.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {VIDEOS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Play video ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-teal-700" : "w-1.5 bg-slate-300"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VideoCard({
  src,
  muted,
  onToggleMute,
  onEnded,
}: {
  src: string;
  muted: boolean;
  onToggleMute: () => void;
  onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    el.play().catch(() => {});
  }, [src, muted]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); }
    else { el.pause(); setPlaying(false); }
  };

  return (
    <div
      className="relative w-full shrink-0 overflow-hidden rounded-md border border-slate-200 bg-black shadow-sm"
      style={{ aspectRatio: "9 / 16" }}
    >
      <button type="button" onClick={togglePlay} className="absolute inset-0 h-full w-full">
        <video
          ref={ref}
          src={src}
          className="h-full w-full object-cover"
          playsInline
          preload="metadata"
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={onEnded}
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
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
      >
        {muted ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.17v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>
    </div>
  );
}
