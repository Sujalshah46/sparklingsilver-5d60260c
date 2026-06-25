import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";

const TITLE = "Jewellery Guides & Buying Tips — Sparkling Jewellers";
const DESC = "Practical guides on gold pricing, purity, hallmarking and choosing the right jewellery for every occasion.";

const POSTS = [
  {
    slug: "gold-price-calculation-guide",
    title: "How to Calculate Gold Jewellery Price in India",
    excerpt: "Understand gold weight, purity, making charges and 3% GST so you know exactly what you're paying for.",
  },
  {
    slug: "22k-vs-18k-gold",
    title: "22K vs 18K Gold — Which Should You Buy?",
    excerpt: "Purity, durability, colour and price compared, so you can pick the right karat for daily wear or bridal jewellery.",
  },
  {
    slug: "bis-hallmarking-explained",
    title: "BIS Hallmarking & Certification Explained",
    excerpt: "What the four-mark BIS hallmark on Indian gold jewellery means and why it protects your purchase.",
  },
];

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://sparkling-jewellers-llp.lovable.app/blog" },
    ],
    links: [{ rel: "canonical", href: "https://sparkling-jewellers-llp.lovable.app/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <MobileShell title="Guides">
      <div className="space-y-4 p-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Jewellery Guides</h1>
        <p className="text-sm text-muted-foreground">Buyer's guides from Sparkling Jewellers — pricing, purity and certification, clearly explained.</p>
        <ul className="space-y-3 pt-2">
          {POSTS.map((p) => (
            <li key={p.slug} className="rounded-xl border border-border bg-card p-4">
              <Link to="/blog/$slug" params={{ slug: p.slug }} className="block">
                <h2 className="font-serif text-lg font-semibold text-foreground">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.excerpt}</p>
                <span className="mt-2 inline-block text-xs font-semibold text-burgundy">Read article →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </MobileShell>
  );
}
