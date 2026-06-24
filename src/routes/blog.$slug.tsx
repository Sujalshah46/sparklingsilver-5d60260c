import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";

type Post = {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  body: { h2: string; paragraphs: string[] }[];
};

const POSTS: Record<string, Post> = {
  "gold-price-calculation-guide": {
    slug: "gold-price-calculation-guide",
    title: "How to Calculate Gold Jewellery Price in India",
    description: "Step-by-step guide to gold jewellery pricing in India — net weight, purity, today's rate, making charges and 3% GST, with a worked example.",
    datePublished: "2026-06-24",
    body: [
      { h2: "The four components of a gold jewellery bill", paragraphs: [
        "Every gold jewellery bill in India is built from four parts: the gold rate on the day of purchase, the net weight of gold in the piece, the making charges your jeweller adds for craftsmanship, and 3% GST on the total. Understand these four and no jewellery bill will ever surprise you again.",
      ] },
      { h2: "Step 1 — Find today's gold rate for the right purity", paragraphs: [
        "Indian jewellery is sold mostly in 22K (91.6% pure) and 18K (75% pure). Daily rates are quoted per gram for each purity. A 22K rate of ₹6,830/g means a gram of 22K gold costs ₹6,830 — that's your base. We publish live 22K, 18K and 24K rates on our gold rate page so you always start from a fair benchmark.",
      ] },
      { h2: "Step 2 — Use net weight, not gross weight", paragraphs: [
        "Gross weight is the total weight of the piece, including any stones. Net weight is the gold-only weight after subtracting stone weight. You are paying gold rate × net weight, not gross weight. A ₹6,830/g rate applied to 9.2 g of net 22K gold gives ₹62,836 — that's the metal value.",
      ] },
      { h2: "Step 3 — Add making charges", paragraphs: [
        "Making charges pay for the design, craftsmanship and wastage. They are usually a percentage of the gold value (typically 8–25% depending on intricacy) or a flat rupees-per-gram figure. On our ₹62,836 example at 12% making, that's ₹7,540.",
      ] },
      { h2: "Step 4 — Add 3% GST on the total", paragraphs: [
        "GST in India on gold jewellery is 3% on the sum of metal value + making charges. (₹62,836 + ₹7,540) × 3% = ₹2,111. Final price = ₹72,487. Every product page on Sparkling Jewellers shows this exact breakdown so you can verify the math before you buy.",
      ] },
      { h2: "Tips before you buy", paragraphs: [
        "Insist on a BIS-hallmarked piece (look for the six-digit HUID). Confirm net weight and making-charge percentage in writing on your invoice. And remember — a higher karat (22K, 24K) is purer but softer; 18K is more durable for everyday rings and bracelets.",
      ] },
    ],
  },
  "22k-vs-18k-gold": {
    slug: "22k-vs-18k-gold",
    title: "22K vs 18K Gold — Which Should You Buy?",
    description: "22K versus 18K gold compared on purity, durability, colour, price and best use cases for Indian buyers.",
    datePublished: "2026-06-24",
    body: [
      { h2: "What the karat number actually means", paragraphs: [
        "Karat measures purity: 22K is 91.6% pure gold, 18K is 75%. The remaining metals (copper, silver, zinc, palladium) are alloys added for strength and colour. Pure 24K gold is too soft to hold gemstones or fine detail, which is why almost no jewellery is sold in 24K.",
      ] },
      { h2: "Durability — 18K wins for daily wear", paragraphs: [
        "Because 18K has 25% alloy content, it's noticeably harder and more scratch-resistant than 22K. Engagement rings, tennis bracelets and any piece you'll wear every day hold their finish far longer in 18K. 22K is best for heavier traditional pieces that aren't subjected to daily knocks.",
      ] },
      { h2: "Colour — 22K is the warmer Indian yellow", paragraphs: [
        "22K has the rich, warm yellow Indians traditionally associate with bridal and festive jewellery. 18K yellow gold is slightly paler. 18K is also available in rose and white gold, which simply isn't possible in 22K.",
      ] },
      { h2: "Price — 22K costs more per gram", paragraphs: [
        "You're paying for the extra gold content, so 22K is meaningfully more expensive per gram than 18K. For diamond-heavy pieces, 18K can give you a bigger, more impressive design for the same budget.",
      ] },
      { h2: "Quick recommendation", paragraphs: [
        "Bridal sets, bangles, mangalsutra, gifting and investment-grade pieces → 22K. Diamond rings, daily-wear chains and bracelets, modern western designs → 18K. Both are BIS-hallmarked at Sparkling Jewellers; the choice is about lifestyle, not quality.",
      ] },
    ],
  },
  "bis-hallmarking-explained": {
    slug: "bis-hallmarking-explained",
    title: "BIS Hallmarking & Certification Explained",
    description: "What the BIS hallmark on Indian gold jewellery means, the symbols on it, and how to verify HUID before you buy.",
    datePublished: "2026-06-24",
    body: [
      { h2: "What BIS hallmarking is", paragraphs: [
        "The Bureau of Indian Standards (BIS) hallmark certifies that a piece of gold jewellery contains the purity claimed by the seller. As of 2023, hallmarking is mandatory across most of India for 14K, 18K, 20K, 22K, 23K and 24K gold jewellery sold by registered jewellers.",
      ] },
      { h2: "The three marks on every hallmarked piece", paragraphs: [
        "Look for three laser-etched marks: the BIS triangle logo, the purity grade (e.g. 22K916 for 22K), and a six-digit alphanumeric HUID (Hallmark Unique Identification). The HUID is unique to your individual piece — no two pieces share the same code.",
      ] },
      { h2: "How to verify your HUID", paragraphs: [
        "Download the official BIS Care app (Android/iOS) and enter the six-digit HUID. The app returns the jeweller's name, registration number, purity and item description. If anything doesn't match what's on your invoice, do not take delivery.",
      ] },
      { h2: "Why this protects you", paragraphs: [
        "Pre-hallmarking, under-karating (selling 18K as 22K) cost Indian buyers thousands of crores a year. With HUID, every piece is traceable to a specific jeweller and assaying centre, and any dispute can be resolved by the BIS itself.",
      ] },
      { h2: "Sparkling Jewellers and BIS", paragraphs: [
        "Every gold piece we sell carries a BIS hallmark and a valid HUID; every diamond is accompanied by an IGI or GIA certificate. Ask for both at checkout — we'll happily walk you through how to verify each one.",
      ] },
    ],
  },
};

export const Route = createFileRoute("/blog/$slug")({
  beforeLoad: ({ params }) => {
    if (!POSTS[params.slug]) throw notFound();
  },
  head: ({ params }) => {
    const post = POSTS[params.slug];
    if (!post) return { meta: [{ title: "Article — Sparkling Jewellers" }] };
    const url = `https://cuddly-code-gen.lovable.app/blog/${post.slug}`;
    return {
      meta: [
        { title: `${post.title} — Sparkling Jewellers` },
        { name: "description", content: post.description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.description,
            datePublished: post.datePublished,
            author: { "@type": "Organization", name: "Sparkling Jewellers LLP" },
            publisher: { "@type": "Organization", name: "Sparkling Jewellers LLP" },
            mainEntityOfPage: url,
          }),
        },
      ],
    };
  },
  component: BlogPost,
  notFoundComponent: () => (
    <MobileShell title="Not found">
      <div className="py-20 text-center text-muted-foreground">Article not found.</div>
    </MobileShell>
  ),
});

function BlogPost() {
  const { slug } = Route.useParams();
  const post = POSTS[slug];
  if (!post) return null;
  return (
    <MobileShell title="Guide">
      <article className="space-y-6 p-4">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-burgundy">Guide</p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-foreground sm:text-3xl">{post.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
        </header>
        {post.body.map((section) => (
          <section key={section.h2} className="space-y-2">
            <h2 className="font-serif text-lg font-semibold text-foreground">{section.h2}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground/90">{p}</p>
            ))}
          </section>
        ))}
        <footer className="border-t border-border pt-4 text-sm">
          <Link to="/blog" className="text-burgundy font-semibold">← Back to all guides</Link>
        </footer>
      </article>
    </MobileShell>
  );
}
