import { describe, it, expect } from "vitest";
import { getNavigationAction } from "./navigationPolicy";

describe("WebView Navigation Policy Tests", () => {
  const SITE_URL = "https://sparklingsilver.in";

  it("should ALLOW first-party URLs internally", () => {
    expect(getNavigationAction("https://sparklingsilver.in/catalogue", SITE_URL)).toBe("ALLOW");
    expect(getNavigationAction("https://www.sparklingsilver.in/auth", SITE_URL)).toBe("ALLOW");
    expect(getNavigationAction("/cart", SITE_URL)).toBe("ALLOW");
    expect(getNavigationAction("#top", SITE_URL)).toBe("ALLOW");
    expect(getNavigationAction("about:blank", SITE_URL)).toBe("ALLOW");
  });

  it("should ALLOW supabase & lovable domains internally", () => {
    expect(getNavigationAction("https://xyz.supabase.co/auth/v1", SITE_URL)).toBe("ALLOW");
    expect(getNavigationAction("https://lovable.app/edit/project", SITE_URL)).toBe("ALLOW");
  });

  it("should EXTERNALISE valid third-party and custom schemes", () => {
    expect(getNavigationAction("whatsapp://send?phone=919930999904", SITE_URL)).toBe("EXTERNAL");
    expect(getNavigationAction("https://wa.me/919930999904", SITE_URL)).toBe("EXTERNAL");
    expect(getNavigationAction("tel:+919324773823", SITE_URL)).toBe("EXTERNAL");
    expect(getNavigationAction("mailto:support@sparklingsilver.in", SITE_URL)).toBe("EXTERNAL");
    expect(getNavigationAction("https://instagram.com/sparklingsilver", SITE_URL)).toBe("EXTERNAL");
    expect(getNavigationAction("https://google.com/search", SITE_URL)).toBe("EXTERNAL");
  });

  it("should BLOCK invalid or unknown custom schemes", () => {
    expect(getNavigationAction("ftp://files.sparklingsilver.in", SITE_URL)).toBe("BLOCK");
    expect(getNavigationAction("file:///etc/passwd", SITE_URL)).toBe("BLOCK");
    expect(getNavigationAction("javascript:alert(1)", SITE_URL)).toBe("BLOCK");
    expect(getNavigationAction("custom-app://open", SITE_URL)).toBe("BLOCK");
  });
});
