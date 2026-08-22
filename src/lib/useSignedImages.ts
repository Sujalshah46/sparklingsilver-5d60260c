import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import { signImageUrls } from "@/lib/image-signing.functions";

/**
 * Swap long-lived storage URLs for freshly signed, 1-hour URLs.
 *
 * Falls back to the original URL while the request is in flight, when the
 * visitor is not signed in, or if signing fails, so images always render.
 * Refetches every 50 minutes so tokens never expire on a long-lived page.
 */
export function useSignedImages(urls: Array<string | null | undefined>) {
  const sign = useServerFn(signImageUrls);

  const list = useMemo(() => {
    const unique = Array.from(
      new Set(urls.filter((u): u is string => !!u && u.includes("/storage/v1/"))),
    );
    return unique.slice(0, 80);
  }, [urls]);

  const key = useMemo(() => [...list].sort().join("|"), [list]);

  const { data } = useQuery({
    queryKey: ["signed-images", key],
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      try {
        return await sign({ data: { urls: list } });
      } catch {
        return {} as Record<string, string>;
      }
    },
  });

  const resolve = useCallback(
    <T extends string | null | undefined>(url: T): T => {
      if (!url) return url;
      return ((data?.[url] as string | undefined) ?? url) as T;
    },
    [data],
  );

  return { resolve, signedMap: data ?? {} };
}
