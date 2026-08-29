export type NavigationAction = 'ALLOW' | 'EXTERNAL' | 'BLOCK';

const INTERNAL_HOST_SUFFIXES = ['sparklingsilver.in', 'lovable.app', 'supabase.co'];

export function getNavigationAction(url: string, siteUrl: string): NavigationAction {
  if (!url || url === 'about:blank') {
    return 'ALLOW';
  }

  try {
    const parsed = new URL(url);

    // 1. First-party Allowed in-app (must be http/https + allowed host)
    const isInternal = 
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      INTERNAL_HOST_SUFFIXES.some(
        (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
      );

    if (isInternal) {
      return 'ALLOW';
    }

    // 2. Allowed External Schemes/Protocols (whatsapp, tel, mailto, instagram)
    const externalSchemes = ['tel:', 'mailto:', 'sms:', 'whatsapp:', 'instagram:'];
    if (externalSchemes.some((scheme) => url.startsWith(scheme))) {
      return 'EXTERNAL';
    }

    // Handle wa.me / web.whatsapp.com redirects as external
    if (parsed.hostname === 'wa.me' || parsed.hostname.endsWith('wa.me') || parsed.hostname.includes('whatsapp')) {
      return 'EXTERNAL';
    }

    if (parsed.hostname === 'instagram.com' || parsed.hostname.endsWith('instagram.com')) {
      return 'EXTERNAL';
    }

    // Any other http/https external URL goes to external browser
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return 'EXTERNAL';
    }

    // 3. Block everything else
    return 'BLOCK';
  } catch {
    // Relative paths are allowed internally
    if (url.startsWith('/') || url.startsWith('#') || url.startsWith('about:')) {
      return 'ALLOW';
    }
    return 'BLOCK';
  }
}
