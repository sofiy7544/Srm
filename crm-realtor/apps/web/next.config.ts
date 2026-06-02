import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  // pnpm-монорепо: трейсим standalone от корня воркспейса, иначе server.js и
  // зависимости из общего node_modules собираются непредсказуемо. С этим
  // server.js оказывается в .next/standalone/apps/web/server.js.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'http',  hostname: 'minio' },
    ],
  },
  // Не блокировать prod-build на стилистических ESLint-ошибках
  // (unescaped apostrophes и т.п.). Локально `pnpm lint` прогоняется отдельно.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Старый URL → новый канонический (чтобы старые закладки/ссылки работали).
  async redirects() {
    return [
      { source: '/dashboard', destination: '/today', permanent: false },
      { source: '/dashboard/:path*', destination: '/today/:path*', permanent: false },
    ];
  },
  // Same-origin proxy: браузер обращается только к домену фронта (/api/*),
  // Next проксирует на бэкенд. Делает cookie аутентификации first-party —
  // иначе мобильный Safari (ITP) режет cross-site cookie и сессия не держится.
  // Цель задаётся server-side переменной API_PROXY_TARGET (URL backend без /).
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_URL ?? '')
      .trim()
      .replace(/^[<"'\s]+|[>"'\s]+$/g, '')
      .replace(/\/+$/, '');
    if (!target) return [];
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
      // Раздача загруженных медиа: файлы лежат на бэкенде по /uploads/*
      // (LocalStorageProvider). Без этого rewrite фронт отдаёт 404 и фото
      // не отображается, хотя загрузка прошла.
      { source: '/uploads/:path*', destination: `${target}/uploads/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
