import { pageTitle, pageDescription, descriptionTags } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";

const TITLE = pageTitle("Silver Jewellery Guides & Buying Tips");
const DESC = "Practical guides on silver pricing, 925 sterling purity, hallmarking and choosing the right silver jewellery for every occasion.";

const POSTS = [
  {
    slug: "silver-price-calculation-guide",
    title: "How to Calculate Silver Jewellery Price in India",
    excerpt: "Understand silver weight, purity, making charges and 3% GST so you know exactly what you're paying for.",
  },
  {
    slug: "925-vs-999-silver",
    title: "925 Sterling vs 999 Fine Silver — Which Should You Buy?",
    excerpt: "Purity, durability, tarnish resistance and price compared, so you can pick the right silver for daily wear or gifting.",
  },
  {
    slug: "bis-hallmarking-explained",
    title: "BIS Hallmarking for Silver Jewellery Explained",
    excerpt: "What the BIS hallmark on Indian silver jewellery means and why it protects your purchase.",
  },
];

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://sparklingsilver.in/blog" },
    ],
    links: [{ rel: "canonical", href: "https://sparklingsilver.in/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <MobileShell title="Guides">
      <div className="space-y-4 p-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Silver Jewellery Guides</h1>
        <p className="text-sm text-muted-foreground">Buyer's guides from Sparkling Silver — silver pricing, purity and certification, clearly explained.</p>
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
