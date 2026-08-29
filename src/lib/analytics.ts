/**
 * Sparkling Silver Analytics & Event Tracking
 * Tracks high-value user milestones (Catalog browse, Product view, Add to Cart, WhatsApp inquiries).
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export type AnalyticsEvent =
  | 'page_view'
  | 'category_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'order_placed'
  | 'whatsapp_inquiry'
  | 'feedback_submitted'
  | 'search_performed';

export function trackEvent(eventName: AnalyticsEvent | string, properties: Record<string, any> = {}) {
  try {
    if (typeof window === 'undefined') return;

    const payload = {
      ...properties,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      path: window.location.pathname,
      isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    };

    // 1. Google Analytics 4 (if configured on the page)
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    }

    // 2. Custom Event for internal listeners
    window.dispatchEvent(
      new CustomEvent('ss:analytics', {
        detail: { eventName, payload },
      }),
    );

    // 3. Dev logger
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${eventName}:`, payload);
    }
  } catch (err) {
    // Fail silently so tracking never breaks user flows
    console.warn('[Analytics Error]', err);
  }
}

export function trackProductView(product: {
  id: string;
  name?: string;
  sku?: string;
  category?: string;
  gross_weight?: number | string;
}) {
  trackEvent('product_view', {
    product_id: product.id,
    product_name: product.name,
    sku: product.sku,
    category: product.category,
    weight: product.gross_weight,
  });
}

export function trackAddToCart(item: {
  id: string;
  name?: string;
  sku?: string;
  quantity?: number;
  weight?: number | string;
}) {
  trackEvent('add_to_cart', {
    item_id: item.id,
    item_name: item.name,
    sku: item.sku,
    quantity: item.quantity ?? 1,
    weight: item.weight,
  });
}

export function trackWhatsAppInquiry(source: string, details: Record<string, any> = {}) {
  trackEvent('whatsapp_inquiry', {
    source,
    ...details,
  });
}

export function trackCategoryView(category: string, subcategory?: string) {
  trackEvent('category_view', {
    category,
    subcategory,
  });
}

export function trackFeedbackSubmitted(type: string, rating?: number) {
  trackEvent('feedback_submitted', {
    feedback_type: type,
    rating,
  });
}
