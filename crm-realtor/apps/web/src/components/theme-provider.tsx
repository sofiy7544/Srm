'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * 5 встроенных тем в стиле iOS Display & Brightness:
 *  - light    — стандартная светлая (warm white)
 *  - dark     — стандартная тёмная (slate)
 *  - sepia    — тёплая кремовая, как в iBooks / Reader Mode (для дневного чтения)
 *  - midnight — глубокая чёрная для OLED-экранов (true black)
 *  - system   — следовать системной настройке (Light↔Dark по prefers-color-scheme)
 */
export type Theme = 'light' | 'dark' | 'sepia' | 'midnight' | 'system';
/** То, что фактически применено к <html> — система разрешается заранее. */
export type ResolvedTheme = 'light' | 'dark' | 'sepia' | 'midnight';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'crm-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'sepia' || v === 'midnight' || v === 'system'
    ? v
    : 'system';
}

function applyMode(resolved: ResolvedTheme) {
  const root = document.documentElement;
  // dark и midnight оба используют .dark class для контраста системных элементов
  // (scrollbar / color-scheme), плюс отдельный data-theme для нашей CSS-палитры.
  const isDarkLike = resolved === 'dark' || resolved === 'midnight';
  if (isDarkLike) root.classList.add('dark');
  else root.classList.remove('dark');
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = isDarkLike ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // первичная гидрация
  useEffect(() => {
    const t = readTheme();
    const resolved = t === 'system' ? getSystemTheme() : t;
    setThemeState(t);
    setResolvedTheme(resolved);
    applyMode(resolved);
  }, []);

  // следим за prefers-color-scheme только в режиме 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const r = mq.matches ? 'dark' : 'light';
      setResolvedTheme(r);
      applyMode(r);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, t);
    const resolved = t === 'system' ? getSystemTheme() : t;
    setThemeState(t);
    setResolvedTheme(resolved);
    applyMode(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: () => undefined,
    };
  }
  return ctx;
}
