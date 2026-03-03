import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server'; // C'était "next/request" avant

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // On rafraîchit la session pour éviter la boucle infinie
  const { data: { session } } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isAuthCallback = req.nextUrl.pathname.startsWith('/auth');

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (!session && !isLoginPage && !isAuthCallback) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico).*)'],
};