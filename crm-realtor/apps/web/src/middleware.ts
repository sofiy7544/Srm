import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/today',
  '/inbox',
  '/dashboard',
  '/clients',
  '/contacts',
  '/properties',
  '/inventory',
  '/leads',
  '/pipeline',
  '/profile',
  '/tasks',
  '/calendar',
  '/settings',
  '/deals',
  '/reports',
  '/insights',
  '/admin',
  '/team',
  '/pool',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const authCookie = req.cookies.get('crm_auth')?.value;
  if (!authCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/today/:path*',
    '/inbox/:path*',
    '/dashboard/:path*',
    '/clients/:path*',
    '/contacts/:path*',
    '/properties/:path*',
    '/inventory/:path*',
    '/leads/:path*',
    '/pipeline/:path*',
    '/profile/:path*',
    '/tasks/:path*',
    '/calendar/:path*',
    '/settings/:path*',
    '/deals/:path*',
    '/reports/:path*',
    '/insights/:path*',
    '/admin/:path*',
    '/team/:path*',
    '/pool/:path*',
  ],
};
