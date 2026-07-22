import { pageTitle, pageDescription, descriptionTags, jsonLdScript, articleSchema, breadcrumbSchema } from "@/lib/seo";
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
  "silver-price-calculation-guide": {
    slug: "silver-price-calculation-guide",
    title: "How to Calculate Silver Jewellery Price in India",
    description: "Step-by-step guide to silver jewellery pricing in India — net weight, purity, today's silver rate, making charges and 3% GST, with a worked example.",
    datePublished: "2026-06-24",
    body: [
      { h2: "The four components of a silver jewellery bill", paragraphs: [
        "Every silver jewellery bill in India is built from four parts: the silver rate on the day of purchase, the net weight of silver in the piece, the making charges your jeweller adds for craftsmanship, and 3% GST on the total. Understand these four and no silver jewellery bill will ever surprise you again.",
      ] },
      { h2: "Step 1 — Find today's silver rate for the right purity", paragraphs: [
        "Silver jewellery in India is sold mostly in 925 sterling (92.5% pure) and 999 fine (99.9% pure). Daily rates are quoted per gram. A 999 rate of ₹95/g means a gram of fine silver costs ₹95 — that's your base for sterling: ₹95 × 0.925 = ₹87.88/g for 925. We publish live silver rates on our silver rate page so you always start from a fair benchmark.",
      ] },
      { h2: "Step 2 — Use net weight, not gross weight", paragraphs: [
        "Gross weight is the total weight of the piece including any stones. Net weight is the silver-only weight after subtracting stone weight. You pay silver rate × net weight, not gross weight. A ₹88/g 925 rate applied to 12 g of net silver gives ₹1,056 — that's the metal value.",
      ] },
      { h2: "Step 3 — Add making charges", paragraphs: [
        "Making charges pay for the design, craftsmanship and wastage. For silver they are usually a percentage of the metal value (typically 15–35% depending on intricacy) or a flat rupees-per-gram figure. Detailed temple-style and antique pieces sit at the higher end because of the hand-finishing involved.",
      ] },
      { h2: "Step 4 — Add 3% GST on the total", paragraphs: [
        "GST in India on silver jewellery is 3% on the sum of metal value + making charges. Every product page on Sparkling Silver shows this exact breakdown so you can verify the math before you buy.",
      ] },
      { h2: "Tips before you buy", paragraphs: [
        "Look for the BIS hallmark with the purity grade (925 or 999) and a six-digit HUID. Confirm net weight and making-charge percentage in writing on your invoice. 925 sterling is the right choice for almost all wearable silver jewellery — 999 is too soft to hold detail or stones.",
      ] },
    ],
  },
  "925-vs-999-silver": {
    slug: "925-vs-999-silver",
    title: "925 Sterling vs 999 Fine Silver — Which Should You Buy?",
    description: "925 sterling versus 999 fine silver compared on purity, durability, tarnish resistance, price and best use cases for Indian buyers.",
    datePublished: "2026-06-24",
    body: [
      { h2: "What the purity number actually means", paragraphs: [
        "925 means 92.5% pure silver alloyed with 7.5% copper (and sometimes zinc) for strength. 999 means 99.9% pure silver — almost no alloy. The alloy in 925 is what makes sterling hard enough to hold stones, prongs and fine detail without bending out of shape.",
      ] },
      { h2: "Durability — 925 wins for wearable jewellery", paragraphs: [
        "Because 999 fine silver is so soft, it dents, scratches and warps with normal wear. 925 sterling is significantly harder, which is why every serious jewellery piece — rings, bangles, kada, mangalsutra, anklets — is made in 925. 999 is best for coins, bullion bars and a few flat decorative pieces.",
      ] },
      { h2: "Tarnish — both tarnish, 925 a little faster", paragraphs: [
        "Silver reacts with sulphur in the air to form a thin dark layer. 999 tarnishes slowly; 925 tarnishes a bit faster because of the copper content. A 30-second polish with a silver cloth restores the shine on either. Store pieces in airtight pouches when not worn.",
      ] },
      { h2: "Price — 999 costs more per gram", paragraphs: [
        "You're paying for the higher silver content, so 999 is more expensive per gram than 925. For wearable jewellery the small price difference doesn't justify the loss of durability — 925 sterling is the standard worldwide for a reason.",
      ] },
      { h2: "Quick recommendation", paragraphs: [
        "Rings, earrings, bangles, kada, mangalsutra, anklets, chains, bracelets, jewellery sets → 925 sterling. Investment, gifting coins, religious idols → 999 fine. Both are BIS-hallmarked at Sparkling Silver; the choice is about use case, not quality.",
      ] },
    ],
  },
  "bis-hallmarking-explained": {
    slug: "bis-hallmarking-explained",
    title: "BIS Hallmarking for Silver Jewellery Explained",
    description: "What the BIS hallmark on Indian silver jewellery means, the symbols on it, and how to verify HUID before you buy.",
    datePublished: "2026-06-24",
    body: [
      { h2: "What BIS hallmarking is", paragraphs: [
        "The Bureau of Indian Standards (BIS) hallmark certifies that a piece of silver jewellery contains the purity claimed by the seller. BIS hallmarking covers silver grades including 800, 900, 925 and 999 sold by registered jewellers.",
      ] },
      { h2: "The marks on every hallmarked piece", paragraphs: [
        "Look for the BIS triangle logo, the purity grade (e.g. 925 for sterling, 999 for fine), and a six-digit alphanumeric HUID (Hallmark Unique Identification). The HUID is unique to your individual piece — no two pieces share the same code.",
      ] },
      { h2: "How to verify your HUID", paragraphs: [
        "Download the official BIS Care app (Android/iOS) and enter the six-digit HUID. The app returns the jeweller's name, registration number, purity and item description. If anything doesn't match what's on your invoice, do not take delivery.",
      ] },
      { h2: "Why this protects you", paragraphs: [
        "Pre-hallmarking, under-grading (selling 800 silver as 925) was common. With HUID, every piece is traceable to a specific jeweller and assaying centre, and any dispute can be resolved by the BIS itself.",
      ] },
      { h2: "Sparkling Silver and BIS", paragraphs: [
        "Every silver piece we sell carries a BIS hallmark and a valid HUID. Ask for the hallmark at checkout — we'll happily walk you through how to verify it on the BIS Care app.",
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
    if (!post) return { meta: [{ title: pageTitle("Article") }] };
    const url = `https://sparklingsilver.in/blog/${post.slug}`;
    return {
      meta: [
        { title: pageTitle(post.title) },
        ...descriptionTags(post.description),
        { property: "og:title", content: post.title },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { name: "twitter:title", content: post.title },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        jsonLdScript([
          articleSchema({
            title: post.title,
            description: post.description,
            url,
            datePublished: post.datePublished,
          }),
          breadcrumbSchema([
            { name: "Home", url: "https://sparklingsilver.in/" },
            { name: "Guides", url: "https://sparklingsilver.in/blog" },
            { name: post.title, url },
          ]),
        ]),
      ],
    };
  },
  component: BlogPost,
  notFoundComponent: () => (
    <MobileShell title="Not found">
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Article not found.</p>
        <Link to="/blog" className="mt-3 inline-block text-sm font-semibold text-teal">Back to guides</Link>
      </div>
    </MobileShell>
  ),
});

function BlogPost() {
  const { slug } = Route.useParams();
  const post = POSTS[slug]!;
  return (
    <MobileShell title="Guide">
      <article className="space-y-4 p-4">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sparkling Silver Guide</p>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-foreground">{post.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
        </header>
        {post.body.map((section) => (
          <section key={section.h2} className="space-y-2">
            <h2 className="font-serif text-lg font-semibold text-foreground">{section.h2}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
            ))}
          </section>
        ))}
        <div className="pt-4">
          <Link to="/blog" className="text-sm font-semibold text-teal">← All guides</Link>
        </div>
      </article>
    </MobileShell>
  );
}
