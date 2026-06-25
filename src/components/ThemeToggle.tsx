// Dark mode disabled. Light theme is forced app-wide.

export function useTheme() {
  return { theme: "light" as const, setTheme: () => {}, toggle: () => {} };
}

export function ThemeToggle({ className: _className = "" }: { className?: string }) {
  return null;
}

/** Force-remove any persisted dark class before paint. */
export const themeInitScript = `(function(){try{document.documentElement.classList.remove('dark');localStorage.removeItem('sj-theme');}catch(e){}})();`;

