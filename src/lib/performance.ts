/**
 * Lightweight navigation-timing report.
 * Dev-only by default so production users pay nothing.
 */
export function logPerformanceMetrics(force = false) {
  if (typeof window === "undefined") return;
  if (!force && !import.meta.env.DEV) return;

  const report = () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;
    const round = (n: number) => Math.round(n);
    // eslint-disable-next-line no-console
    console.info("[perf]", {
      dnsLookup: round(nav.domainLookupEnd - nav.domainLookupStart),
      tcpConnect: round(nav.connectEnd - nav.connectStart),
      ttfb: round(nav.responseStart - nav.requestStart),
      domInteractive: round(nav.domInteractive - nav.fetchStart),
      domComplete: round(nav.domComplete - nav.fetchStart),
      pageLoad: round(nav.loadEventEnd - nav.fetchStart),
    });
  };

  if (document.readyState === "complete") report();
  else window.addEventListener("load", report, { once: true });
}
