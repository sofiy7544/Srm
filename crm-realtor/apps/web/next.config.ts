import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Без standalone — мы запускаем через PM2 + `next start`, который НЕ работает
  // с output: 'standalone' (для standalone нужно node .next/standalone/server.js).
  // Несогласованность ломает Server Actions хеши после ребилда.
  // output: 'standalone',
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
};

export default withNextIntl(nextConfig);
