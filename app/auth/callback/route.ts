import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    // Échange le code temporaire contre une session utilisateur réelle
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Une fois connecté, on renvoie l'utilisateur à la racine de l'app
  return NextResponse.redirect(requestUrl.origin);
}