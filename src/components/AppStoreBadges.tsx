import React from 'react';
import { trackEvent } from '@/lib/analytics';

interface AppStoreBadgesProps {
  className?: string;
}

export function AppStoreBadges({ className = '' }: AppStoreBadgesProps) {
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    return null;
  }

  const handleStoreClick = (store: 'google_play' | 'app_store') => {
    trackEvent('store_badge_click', { store });
  };

  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      {/* Google Play Store Badge */}
      <a
        href="https://play.google.com/store/apps/details?id=com.sparklingsilver.app"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleStoreClick('google_play')}
        className="inline-flex h-10 items-center gap-2.5 rounded-lg bg-black px-3.5 py-1 text-white shadow-sm ring-1 ring-white/20 transition-transform hover:scale-105 active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-white" aria-hidden="true">
          <path d="M3.609 1.814L13.792 12 3.61 22.186c-.347-.294-.555-.724-.555-1.226V3.04c0-.502.208-.932.554-1.226zM15.207 13.414l2.122 2.121-12.784 7.382 10.662-9.503zm0-2.828L4.545 1.083l12.784 7.382-2.122 2.121zm1.414 1.414l3.197 3.197c.451.451 1.183.451 1.634 0l.447-.447c.451-.451.451-1.183 0-1.634l-1.116-1.116 1.116-1.116c.451-.451.451-1.183 0-1.634l-.447-.447c-.451-.451-1.183-.451-1.634 0l-3.197 3.197z" />
        </svg>
        <div className="flex flex-col text-left leading-none">
          <span className="text-[9px] uppercase tracking-wider text-slate-300">GET IT ON</span>
          <span className="text-[13px] font-semibold text-white">Google Play</span>
        </div>
      </a>

      {/* Apple App Store Badge */}
      <a
        href="https://apps.apple.com/app/sparkling-silver/id6742358899"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleStoreClick('app_store')}
        className="inline-flex h-10 items-center gap-2.5 rounded-lg bg-black px-3.5 py-1 text-white shadow-sm ring-1 ring-white/20 transition-transform hover:scale-105 active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-white" aria-hidden="true">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.62-.75 1.04-1.8 0.92-2.84-.9.04-1.98.6-2.63 1.35-.57.65-1.07 1.72-.94 2.74 1 .08 2.03-.5 2.65-1.25z" />
        </svg>
        <div className="flex flex-col text-left leading-none">
          <span className="text-[9px] uppercase tracking-wider text-slate-300">Download on the</span>
          <span className="text-[13px] font-semibold text-white">App Store</span>
        </div>
      </a>
    </div>
  );
}
