import { createClient } from '@supabase/supabase-js';

// Ces variables seront récupérées automatiquement par Vercel 
// via les variables d'environnement que tu as configurées.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Attention : Les clés Supabase sont manquantes dans les variables d'environnement.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);