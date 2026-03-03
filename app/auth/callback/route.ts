import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    // Cette ligne est CRUCIALE : elle transforme le code Google en session réelle
    await supabase.auth.exchangeCodeForSession(code);
  }

  // On redirige vers l'accueil une fois la session créée
  return NextResponse.redirect(requestUrl.origin);
}
