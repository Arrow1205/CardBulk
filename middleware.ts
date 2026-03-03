import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // On vérifie si une session active existe
  const { data: { session } } = await supabase.auth.getSession();

  // Si pas de session et qu'on n'est pas déjà sur login/auth -> Direction Login
  if (!session && !req.nextUrl.pathname.startsWith('/login') && !req.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};