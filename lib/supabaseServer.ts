import { createClient } from '@supabase/supabase-js';

// L'app gère la session côté client avec le client Supabase classique (localStorage),
// pas avec les helpers Next.js basés sur les cookies (@supabase/auth-helpers-nextjs).
// Les routes API doivent donc s'authentifier via le token Bearer envoyé explicitement
// par le client, plutôt que via createRouteHandlerClient({ cookies }) qui ne verrait rien.
export function supabaseFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
}
