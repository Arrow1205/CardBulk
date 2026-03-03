import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    // Force l'échange du code contre une session réelle
    await supabase.auth.exchangeCodeForSession(code);
  }

  // URL de redirection après connexion réussie
  return NextResponse.redirect(new URL('/', request.url));
}