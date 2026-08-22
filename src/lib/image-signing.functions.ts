import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_BUCKETS = ["product-images", "category-images"] as const;

/** Signed URL lifetime: 1 hour. */
export const SIGNED_URL_TTL_SECONDS = 3600;

const inputSchema = z.object({
  urls: z.array(z.string().min(1).max(2000)).min(1).max(80),
});

/**
 * Parse a Supabase Storage URL (public, signed, or render/image form) into
 * `{ bucket, path }`. Returns null for anything that is not a storage URL in an
 * allowed bucket, or that tries to traverse out of it.
 */
export function parseStorageUrl(
  url: string,
): { bucket: (typeof ALLOWED_BUCKETS)[number]; path: string } | null {
  if (!url || !url.includes("/storage/v1/")) return null;
  const withoutQuery = url.split("?")[0] ?? url;
  const m = withoutQuery.match(
    /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
  );
  if (!m) return null;
  const bucket = m[1] as (typeof ALLOWED_BUCKETS)[number];
  const rawPath = m[2] ?? "";
  if (!ALLOWED_BUCKETS.includes(bucket)) return null;
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    path = rawPath;
  }
  if (!path || path.includes("..")) return null;
  return { bucket, path };
}

/**
 * Re-sign storage image URLs with short-lived (1 hour) tokens.
 * Authenticated-only: signed links are never handed to anonymous visitors, so
 * scraped URLs stop working within the hour.
 *
 * Returns a map of the original URL -> freshly signed URL. URLs that are not
 * storage URLs (bundled assets, data URLs) are returned unchanged.
 */
export const signImageUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const out: Record<string, string> = {};
    const byBucket = new Map<string, { paths: string[]; originals: string[] }>();

    for (const url of data.urls) {
      const parsed = parseStorageUrl(url);
      if (!parsed) {
        out[url] = url;
        continue;
      }
      const entry = byBucket.get(parsed.bucket) ?? { paths: [], originals: [] };
      entry.paths.push(parsed.path);
      entry.originals.push(url);
      byBucket.set(parsed.bucket, entry);
    }

    for (const [bucket, { paths, originals }] of byBucket) {
      const { data: signed, error } = await context.supabase.storage
        .from(bucket)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (error || !signed) {
        // Fail soft: keep the existing URL so images still render.
        originals.forEach((u) => (out[u] = u));
        continue;
      }
      signed.forEach((s, i) => {
        const original = originals[i]!;
        out[original] = s.signedUrl ?? original;
      });
    }

    return out;
  });
