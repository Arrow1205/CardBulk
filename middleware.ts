import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // 1. On rafraîchit la session (indispensable pour éviter la boucle)
  const { data: { session } } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isAuthCallback = req.nextUrl.pathname.startsWith('/auth');

  // 2. Si l'utilisateur est connecté et essaie d'aller sur /login -> On l'envoie sur l'accueil
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 3. Si l'utilisateur n'est PAS connecté et n'est pas sur une page d'auth -> Direction /login
  if (!session && !isLoginPage && !isAuthCallback) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico).*)'],
};