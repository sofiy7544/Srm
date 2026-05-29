import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const standalone = process.env.NEXT_OUTPUT_STANDALONE === '1';

const nextConfig: NextConfig = {
  // По умолчанию (PM2 + `next start`) standalone выключен, чтобы не ломать
  // хеши Server Actions после ребилда. Для контейнерного деплоя (Docker на
  // Render/Railway и т.п.) сборка идёт с NEXT_OUTPUT_STANDALONE=1 — тогда
  // Next кладёт self-contained сервер в .next/standalone, как ждёт Dockerfile.
  output: standalone ? 'standalone' : undefined,
  // В pnpm-монорепо standalone должен трейситься от корня воркспейса, иначе
  // зависимости из общего node_modules не попадут в self-contained сервер.
  ...(standalone ? { outputFileTracingRoot: path.join(__dirname, '../../') } : {}),
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
