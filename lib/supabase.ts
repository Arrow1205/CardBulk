import { createClient } from '@supabase/supabase-js';

// Récupération des variables d'environnement configurées sur Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Sécurité : on affiche une erreur si les clés sont vides
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Erreur : NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY est manquante."
  );
}

// Initialisation du client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);