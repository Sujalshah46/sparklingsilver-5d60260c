#!/usr/bin/env node
/**
 * Validate JSON-LD schema output from src/lib/seo.ts:
 *  - Every helper produces well-formed JSON with @context + @type
 *  - No serialised string anywhere contains the legacy "LLP" token
 *  - No source file under src/ or public/ contains a stray "LLP" mention
 *
 * Runs in CI (npm run validate:jsonld) and as part of `bun run build`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const errors = [];

// 1) Bundle src/lib/seo.ts to plain ESM we can import at runtime.
const outDir = mkdtempSync(join(tmpdir(), "seo-validate-"));
const outFile = join(outDir, "seo.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/seo.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: outFile,
  logLevel: "silent",
});
const seo = await import(pathToFileURL(outFile).href);

// 2) Exercise every schema helper and jsonLdScript wrapper.
const samples = [
  ["organizationSchema", seo.organizationSchema()],
  ["websiteSchema", seo.websiteSchema()],
  [
    "jewelryStoreSchema",
    seo.jewelryStoreSchema({
      url: "https://sparklingsilver.in",
      telephone: "+91-93306-15237",
      email: "test@sparklingsilver.in",
      address: {
        streetAddress: "Sparkling Silver LLP",
        addressLocality: "Singur",
        postalCode: "712409",
        addressCountry: "IN",
      },
    }),
  ],
  [
    "productSchema",
    seo.productSchema({
      name: "Sparkling Silver LLP Antique Necklace",
      sku: "AR(NK)-001",
      url: "https://sparklingsilver.in/product/x",
      price: 1000,
      description: "Sparkling Silver LLP — sample",
    }),
  ],
  [
    "articleSchema",
    seo.articleSchema({
      title: "Sparkling Silver LLP Blog",
      url: "https://sparklingsilver.in/blog/x",
    }),
  ],
  [
    "collectionPageSchema",
    seo.collectionPageSchema({
      name: "Sparkling Silver LLP Antique",
      url: "https://sparklingsilver.in/category/antique",
    }),
  ],
  [
    "breadcrumbSchema",
    seo.breadcrumbSchema([
      { name: "Home", url: "https://sparklingsilver.in/" },
      { name: "Sparkling Silver LLP", url: "https://sparklingsilver.in/x" },
    ]),
  ],
];

for (const [name, node] of samples) {
  const script = seo.jsonLdScript(node);
  if (script.type !== "application/ld+json") {
    errors.push(`${name}: jsonLdScript type is "${script.type}", expected "application/ld+json"`);
  }
  let parsed;
  try {
    parsed = JSON.parse(script.children);
  } catch (e) {
    errors.push(`${name}: emitted invalid JSON (${e.message})`);
    continue;
  }
  const nodes = Array.isArray(parsed) ? parsed : [parsed];
  for (const n of nodes) {
    if (!n["@context"]) errors.push(`${name}: missing @context`);
    if (!n["@type"]) errors.push(`${name}: missing @type`);
  }
  if (/\bLLP\b/i.test(script.children)) {
    errors.push(`${name}: serialised JSON-LD still contains "LLP" after scrubJsonLd`);
  }
}

// 3) Grep the source tree for any lingering "LLP" occurrences.
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".output", ".vinxi",
  ".lovable", "coverage", "playwright-report", "test-results",
]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".html", ".css", ".md", ".xml", ".txt", ".webmanifest",
]);
const scanRoots = ["src", "public"];
const offenders = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (TEXT_EXT.has(extname(entry))) {
      // Skip this validator itself — it intentionally contains "LLP" fixtures.
      if (p.endsWith(join("scripts", "validate-jsonld.mjs"))) continue;
      const content = readFileSync(p, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (/\bLLP\b/.test(line)) offenders.push(`${p}:${i + 1}: ${line.trim()}`);
      });
    }
  }
}
for (const r of scanRoots) {
  try { walk(join(ROOT, r)); } catch {}
}
if (offenders.length) {
  errors.push(`Found "LLP" in source files:\n  ${offenders.join("\n  ")}`);
}

if (errors.length) {
  console.error("\n❌ JSON-LD validation failed:\n");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`✅ JSON-LD validation passed (${samples.length} schemas, no "LLP" found).`);
