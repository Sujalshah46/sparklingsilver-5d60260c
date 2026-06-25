import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export type HeroSlide = {
  src: string;
  collection: string;
  to: string;
};

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <section className="relative w-full overflow-hidden bg-black" style={{ height: "55vh", minHeight: 320 }}>
      {slides.map((s, idx) => (
        <Link
          key={s.src}
          to={s.to}
          className="absolute inset-0 block transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}
        >
          <img src={s.src} alt={s.collection} className="h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-10 px-6 text-white">
            <div className="mb-2 text-2xl text-white/90">✦</div>
            <h2 className="font-display text-5xl font-light italic leading-none">{s.collection}</h2>
            <p className="mt-3 text-[13px] tracking-[0.35em] text-white/95">C O L L E C T I O N</p>
          </div>
        </Link>
      ))}
      <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-1.5">
        {slides.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Slide ${idx + 1}`}
            onClick={() => setI(idx)}
            className="h-1 rounded-full transition-all"
            style={{
              width: i === idx ? 22 : 10,
              background: i === idx ? "#5BBFAD" : "rgba(255,255,255,0.55)",
            }}
          />
        ))}
      </div>
    </section>
  );
}
