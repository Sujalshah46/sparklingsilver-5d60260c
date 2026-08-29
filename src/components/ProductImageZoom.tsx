/**
 * ProductImageZoom.tsx
 * ---------------------------------------------------------------------------
 * Amazon/Flipkart-style pinch-to-zoom image viewer.
 *
 * Zero dependencies. Works with touch (iOS WebView / Android) and mouse.
 *
 * Features
 *   - Pinch to zoom (two fingers), zooms about the pinch midpoint
 *   - Double-tap / double-click to toggle zoom about the tap point
 *   - Drag to pan when zoomed in
 *   - Swipe left/right to change image when NOT zoomed
 *   - Ctrl+wheel / trackpad pinch on desktop
 *   - Escape to close, arrow keys to navigate
 *   - Blocks long-press "Save Image", drag-to-desktop, and right-click menu
 *
 * Drop this file in: src/components/ProductImageZoom.tsx
 * ---------------------------------------------------------------------------
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ config */

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 24; // px of movement still counted as a tap
const SWIPE_THRESHOLD = 60; // px before a horizontal drag changes image

/* ------------------------------------------------------------------- types */

type Transform = { scale: number; tx: number; ty: number };

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };

export type ProductImageZoomProps = {
  images: string[];
  open: boolean;
  onClose: () => void;
  startIndex?: number;
  alt?: string;
};

/* --------------------------------------------------------------- utilities */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * Keep the image from being dragged outside the viewport.
 * With transform-origin at center, a scaled image extends
 * (renderedSize * scale) / 2 either side of centre, so the maximum
 * allowed offset is however much of that overflows the container.
 */
function clampTransform(
  t: Transform,
  container: { w: number; h: number },
  image: { w: number; h: number },
): Transform {
  const scale = clamp(t.scale, MIN_SCALE, MAX_SCALE);
  const maxTx = Math.max(0, (image.w * scale - container.w) / 2);
  const maxTy = Math.max(0, (image.h * scale - container.h) / 2);
  return {
    scale,
    tx: clamp(t.tx, -maxTx, maxTx),
    ty: clamp(t.ty, -maxTy, maxTy),
  };
}

/**
 * Scale about an anchor point (given in coordinates relative to the
 * container's centre) so the pixel under the fingers stays put.
 */
function scaleAbout(t: Transform, nextScale: number, anchorX: number, anchorY: number): Transform {
  const s = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const ratio = s / t.scale;
  return {
    scale: s,
    tx: anchorX - (anchorX - t.tx) * ratio,
    ty: anchorY - (anchorY - t.ty) * ratio,
  };
}

/* ----------------------------------------------------------------- component */

export function ProductImageZoom({
  images,
  open,
  onClose,
  startIndex = 0,
  alt = "Product image",
}: ProductImageZoomProps) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(startIndex);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Live pointer positions, keyed by pointerId.
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Snapshot of the gesture in progress.
  const gesture = useRef({
    mode: "none" as "none" | "pan" | "pinch",
    startDist: 0,
    start: IDENTITY as Transform,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const lastTap = useRef({ time: 0, x: 0, y: 0 });

  const zoomed = transform.scale > MIN_SCALE + 0.01;

  /* ----------------------------------------------------------- lifecycle */

  useEffect(() => setMounted(true), []);

  // Reset to a clean state each time the viewer opens.
  useEffect(() => {
    if (open) {
      setIndex(startIndex);
      setTransform(IDENTITY);
    }
  }, [open, startIndex]);

  // Reset zoom when moving between images.
  useEffect(() => setTransform(IDENTITY), [index]);

  // Lock background scrolling while open.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keyboard: Escape closes, arrows navigate.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, images.length]);

  /**
   * iOS Safari/WebView fires proprietary `gesture*` events for page pinch-zoom
   * and ignores `touch-action` for it. Without this the whole page zooms
   * behind the modal. Non-passive so preventDefault actually applies.
   */
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const block = (e: Event) => e.preventDefault();
    const opts = { passive: false } as AddEventListenerOptions;
    document.addEventListener("gesturestart", block, opts);
    document.addEventListener("gesturechange", block, opts);
    document.addEventListener("gestureend", block, opts);
    return () => {
      document.removeEventListener("gesturestart", block, opts);
      document.removeEventListener("gesturechange", block, opts);
      document.removeEventListener("gestureend", block, opts);
    };
  }, [open]);

  /* ------------------------------------------------------------ measuring */

  const measure = useCallback(() => {
    const c = containerRef.current;
    const img = imageRef.current;
    if (!c || !img) return null;
    return {
      container: { w: c.clientWidth, h: c.clientHeight },
      // offsetWidth/Height are the *layout* size, unaffected by our transform.
      image: { w: img.offsetWidth, h: img.offsetHeight },
    };
  }, []);

  const applyTransform = useCallback(
    (next: Transform) => {
      const m = measure();
      setTransform(m ? clampTransform(next, m.container, m.image) : next);
    },
    [measure],
  );

  /** Convert a client point into coordinates relative to the container centre. */
  const toCentreCoords = useCallback((clientX: number, clientY: number) => {
    const c = containerRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: clientX - r.left - r.width / 2,
      y: clientY - r.top - r.height / 2,
    };
  }, []);

  /* ------------------------------------------------------------- gestures */

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...pointers.current.values()];

    if (pts.length === 1) {
      gesture.current = {
        mode: "pan",
        startDist: 0,
        start: transform,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      setDragging(true);
    } else if (pts.length === 2) {
      const mid = midpoint(pts[0], pts[1]);
      gesture.current = {
        mode: "pinch",
        startDist: distance(pts[0], pts[1]),
        start: transform,
        startX: mid.x,
        startY: mid.y,
        moved: true, // a pinch is never a tap
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...pointers.current.values()];
    const g = gesture.current;

    /* ---- two fingers: pinch zoom, and pan with the midpoint ---- */
    if (g.mode === "pinch" && pts.length >= 2) {
      const dist = distance(pts[0], pts[1]);
      if (g.startDist <= 0) return;

      const mid = midpoint(pts[0], pts[1]);
      const anchor = toCentreCoords(g.startX, g.startY);
      const nextScale = g.start.scale * (dist / g.startDist);

      // Zoom about the original midpoint...
      const zoomedT = scaleAbout(g.start, nextScale, anchor.x, anchor.y);
      // ...then follow the midpoint as the fingers travel.
      applyTransform({
        scale: zoomedT.scale,
        tx: zoomedT.tx + (mid.x - g.startX),
        ty: zoomedT.ty + (mid.y - g.startY),
      });
      return;
    }

    /* ---- one finger ---- */
    if (g.mode === "pan" && pts.length === 1) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (Math.hypot(dx, dy) > DOUBLE_TAP_SLOP) gesture.current.moved = true;

      // Only pan the image when there is something to pan.
      if (g.start.scale > MIN_SCALE + 0.01) {
        applyTransform({ scale: g.start.scale, tx: g.start.tx + dx, ty: g.start.ty + dy });
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const released = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);

    // Still mid-pinch — wait for the second finger.
    if (pointers.current.size > 0) {
      gesture.current.mode = "pan";
      gesture.current.start = transform;
      gesture.current.startX = e.clientX;
      gesture.current.startY = e.clientY;
      return;
    }

    setDragging(false);

    // Snap back to fit if the pinch ended below 1x.
    if (transform.scale < MIN_SCALE + 0.01) {
      setTransform(IDENTITY);
    }

    if (g.mode !== "pan" || !released) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    /* ---- swipe between images (only when not zoomed) ---- */
    if (
      g.start.scale <= MIN_SCALE + 0.01 &&
      Math.abs(dx) > SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      setIndex((i) => clamp(dx < 0 ? i + 1 : i - 1, 0, images.length - 1));
      return;
    }

    if (g.moved) return;

    /* ---- tap / double-tap ---- */
    const now = Date.now();
    const isDouble =
      now - lastTap.current.time < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - lastTap.current.x, e.clientY - lastTap.current.y) < DOUBLE_TAP_SLOP;

    if (isDouble) {
      lastTap.current = { time: 0, x: 0, y: 0 };
      const anchor = toCentreCoords(e.clientX, e.clientY);
      if (zoomed) {
        setTransform(IDENTITY);
      } else {
        applyTransform(scaleAbout(transform, DOUBLE_TAP_SCALE, anchor.x, anchor.y));
      }
    } else {
      lastTap.current = { time: now, x: e.clientX, y: e.clientY };
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  /* ---- desktop: ctrl+wheel or trackpad pinch ---- */
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const anchor = toCentreCoords(e.clientX, e.clientY);
    applyTransform(scaleAbout(transform, transform.scale * (1 - e.deltaY * 0.01), anchor.x, anchor.y));
  };

  /* --------------------------------------------------------------- render */

  if (!mounted || !open || images.length === 0) return null;

  const go = (delta: number) => setIndex((i) => clamp(i + delta, 0, images.length - 1));

  const surfaceStyle: CSSProperties = {
    touchAction: "none", // we handle every gesture ourselves
    WebkitUserSelect: "none",
    userSelect: "none",
    WebkitTouchCallout: "none", // suppresses the iOS "Save Image" sheet
    cursor: zoomed ? (dragging ? "grabbing" : "grab") : "zoom-in",
  };

  const imageStyle: CSSProperties = {
    transform: `translate3d(${transform.tx}px, ${transform.ty}px, 0) scale(${transform.scale})`,
    transformOrigin: "center center",
    transition: dragging || pointers.current.size > 0 ? "none" : "transform 220ms ease-out",
    willChange: "transform",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    WebkitUserSelect: "none",
    userSelect: "none",
    WebkitTouchCallout: "none",
    pointerEvents: "none", // gestures belong to the surface, not the <img>
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
    >
      {/* ---------------------------------------------------------- header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm tabular-nums opacity-80">
          {images.length > 1 ? `${index + 1} / ${images.length}` : ""}
        </span>

        <div className="flex items-center gap-2">
          {zoomed && (
            <button
              type="button"
              onClick={() => setTransform(IDENTITY)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image viewer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl leading-none hover:bg-white/20"
          >
            &times;
          </button>
        </div>
      </div>

      {/* --------------------------------------------------- zoom surface */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={surfaceStyle}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
      >
        <img
          ref={imageRef}
          src={images[index]}
          alt={alt}
          draggable={false}
          style={imageStyle}
          onLoad={() => setTransform(IDENTITY)}
        />

        {/* Desktop arrows — hidden on touch, where swiping does the job. */}
        {images.length > 1 && !zoomed && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              aria-label="Previous image"
              className="absolute left-3 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 md:flex"
            >
              &#8249;
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === images.length - 1}
              aria-label="Next image"
              className="absolute right-3 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 md:flex"
            >
              &#8250;
            </button>
          </>
        )}
      </div>

      {/* ---------------------------------------------------------- footer */}
      <div className="relative z-10 px-4 pb-5 pt-3">
        {images.length > 1 ? (
          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === index}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${
                  i === index ? "border-white" : "border-transparent opacity-50"
                }`}
              >
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                  style={{ WebkitTouchCallout: "none", pointerEvents: "none" }}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-white/50">
            Pinch or double-tap to zoom
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------------------
 * ProductGallery — the inline gallery for a product detail page.
 * Tapping the main image opens the zoom viewer above.
 * ----------------------------------------------------------------------- */

export type ProductGalleryProps = {
  images: string[];
  /**
   * Small (~300w) counterparts to `images`, used for the thumbnail strip so a
   * 64px tile doesn't download the full 1200w detail render. Falls back to
   * `images` when not supplied.
   */
  thumbs?: string[];
  alt?: string;
  className?: string;
};

export function ProductGallery({ images, thumbs, alt = "Product image", className = "" }: ProductGalleryProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);

  if (!images || images.length === 0) {
    return (
      <div className={`flex aspect-square items-center justify-center rounded-lg bg-neutral-100 ${className}`}>
        <span className="text-sm text-neutral-400">No image</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open image viewer"
        className="group relative block w-full overflow-hidden rounded-lg bg-neutral-50"
      >
        {/* Dark-green themed shimmer occupying the reserved square until the
            main image decodes — no blank gap, no layout shift. */}
        {!loaded && <span aria-hidden className="img-skeleton absolute inset-0" />}
        <img
          src={images[active]}
          alt={alt}
          width={1200}
          height={1200}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onContextMenu={(e) => e.preventDefault()}
          className={`aspect-square w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
        />
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
          Tap to zoom
        </span>
      </button>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => { setActive(i); setLoaded(false); }}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition ${
                i === active ? "border-neutral-900" : "border-transparent opacity-60"
              }`}
            >
              <img
                src={thumbs?.[i] ?? src}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="h-full w-full object-cover"
                style={{ WebkitTouchCallout: "none", pointerEvents: "none" }}
              />
            </button>
          ))}
        </div>
      )}

      <ProductImageZoom
        images={images}
        open={open}
        startIndex={active}
        onClose={() => setOpen(false)}
        alt={alt}
      />
    </div>
  );
}

export default ProductGallery;
