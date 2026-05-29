import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      // Letter-spacing — семантически: heading→tight2, body→tightish, eyebrow→wider.
      letterSpacing: {
        tightish: '-0.011em', // body / paragraph
        tight2: '-0.02em',    // H1..H3
        eyebrow: '0.06em',    // uppercase labels (вместо tracking-wide)
      },
      // Дополнительные мелкие размеры с осмысленным line-height. Заменяют
      // захардкоженные text-[10px] / text-[11px] которых в проекте было 60+.
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '-0.005em' }], // 11px
        '3xs': ['0.625rem',  { lineHeight: '0.875rem', letterSpacing: '0' }],    // 10px (микро-чипы, бейджи)
      },
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.05)',
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px rgba(16, 24, 40, 0.05)',
        lift: '0 4px 8px rgba(16, 24, 40, 0.04), 0 12px 32px rgba(16, 24, 40, 0.10)',
        glow: '0 0 0 4px rgba(37, 99, 235, 0.10)',
        'glow-strong': '0 0 0 6px rgba(37, 99, 235, 0.15), 0 8px 24px rgba(37, 99, 235, 0.20)',
      },
      backdropBlur: { xs: '2px' },
      // mobile safe-area-aware bottom padding: bottom-nav + zazor + iOS notch
      // на md+ media-query это утилита всё ещё работает, но компонент <MobileNav>
      // скрыт через md:hidden — лишний паддинг не мешает.
      padding: {
        'mobile-nav': 'max(6rem, calc(env(safe-area-inset-bottom, 0px) + 5.25rem))',
      },
      // safe-area-aware insets для fixed-элементов
      inset: {
        'safe-bottom': 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))',
      },
      minHeight: {
        // WCAG 2.5.5: 44px минимум для touch-targets
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
