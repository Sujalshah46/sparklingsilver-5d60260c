import React, { useEffect, useState } from 'react';
import { X, Smartphone, Download, Star } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other');

  useEffect(() => {
    // Suppress in native app shell
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
      return;
    }

    // Only show on mobile devices
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (!isAndroid && !isIOS) return;

    setPlatform(isAndroid ? 'android' : 'ios');

    // Check if user already dismissed it this session
    const dismissed = sessionStorage.getItem('ss_app_banner_dismissed');
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('ss_app_banner_dismissed', 'true');
    trackEvent('app_banner_dismissed', { platform });
  };

  const handleDownload = () => {
    trackEvent('app_banner_click', { platform });
    if (platform === 'android') {
      window.open('https://play.google.com/store/apps/details?id=com.sparklingsilver.app', '_blank');
    } else {
      window.open('https://apps.apple.com/app/sparkling-silver/id6742358899', '_blank');
    }
  };

  return (
    <div className="relative z-40 flex items-center justify-between border-b border-amber-200 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 px-3 py-2 text-slate-800 shadow-sm transition-all animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2.5">
        <button
          onClick={handleDismiss}
          className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-white shadow-sm ring-1 ring-black/10">
          <Smartphone className="h-5 w-5 text-amber-300" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-bold tracking-tight text-slate-900">
              Sparkling Silver App
            </span>
            <span className="flex items-center gap-0.5 rounded bg-amber-200/60 px-1 py-0.2 text-[9px] font-semibold text-amber-900">
              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> 4.9
            </span>
          </div>
          <span className="text-[10px] text-slate-600">
            Faster ordering & confidential wholesale rates
          </span>
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="flex shrink-0 items-center gap-1 rounded-full bg-[#2C7A76] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#236360] active:scale-95 transition-all"
      >
        <Download className="h-3 w-3" />
        <span>Get App</span>
      </button>
    </div>
  );
}
