import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 📂 Importation de tes fichiers JSON
import FOOTBALL_CLUBS from '@/data/football-clubs.json';
import BASKETBALL_CLUBS from '@/data/basketball-clubs.json';
import BASEBALL_CLUBS from '@/data/baseball-clubs.json';

const CLUB_DATA: Record<string, any[]> = {
  'SOCCER': FOOTBALL_CLUBS,
  'BASKETBALL': BASKETBALL_CLUBS,
  'BASEBALL': BASEBALL_CLUBS,
};

// 🥷 Fonction de nettoyage (identique à ton scanner)
const normalizeClubName = (str: string) => {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/\b(fc|sc|ac|rc|as|cf|osc|united|city)\b/g, '') 
    .replace(/[^\w\s]/g, '') 
    .trim();
};

// 🕵️‍♂️ L'algorithme qui trouve le "vrai" nom depuis un alias ou une faute
const getCanonicalClubName = (rawClub: string, sport: string) => {
  if (!rawClub || !sport) return rawClub;
  const clubs = CLUB_DATA[sport];
  if (!Array.isArray(clubs)) return rawClub;

  const searchNorm = normalizeClubName(rawClub);
  const rawClean = rawClub.toLowerCase().trim();

  for (const c of clubs) {
    if (c.name.toLowerCase().trim() === rawClean) return c.name;
    if (c.aliases && c.aliases.some((a: string) => a.toLowerCase().trim() === rawClean)) return c.name;
    
    const nameNorm = normalizeClubName(c.name);
    if (nameNorm && searchNorm && nameNorm === searchNorm) return c.name;
    
    if (c.aliases && c.aliases.some((a: string) => {
        const aNorm = normalizeClubName(a);
        return aNorm && searchNorm && aNorm === searchNorm;
    })) return c.name;
  }
  
  return rawClub; // Si on ne trouve rien, on renvoie le nom d'origine
};

export async function GET(req: Request) {
  // 🔒 SÉCURITÉ VERCEL
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Accès non autorisé', { status: 401 });
  }

  try {
    // 1️⃣ On récupère toutes les cartes qui ont un club renseigné
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, sport, club_name')
      .not('club_name', 'is', null)
      .neq('club_name', '');

    if (error) throw error;
    if (!cards || cards.length === 0) {
      return NextResponse.json({ success: true, message: 'Aucun club à vérifier.' });
    }

    // 2️⃣ On cherche les anomalies
    // On utilise un Map pour ne corriger chaque faute qu'une seule fois
    const updatesToMake = new Map<string, { sport: string, oldName: string, newName: string }>();

    for (const card of cards) {
      const canonicalName = getCanonicalClubName(card.club_name, card.sport);
      
      // S'il y a une différence entre le nom en base et le nom officiel du JSON
      if (canonicalName !== card.club_name) {
        const uniqueKey = `${card.sport}:::${card.club_name}`;
        if (!updatesToMake.has(uniqueKey)) {
          updatesToMake.set(uniqueKey, {
            sport: card.sport,
            oldName: card.club_name,
            newName: canonicalName
          });
        }
      }
    }

    // 3️⃣ On applique les corrections dans la base de données
    let correctionsCount = 0;
    for (const update of Array.from(updatesToMake.values())) {
      await supabase
        .from('cards')
        .update({ club_name: update.newName })
        .eq('club_name', update.oldName)
        .eq('sport', update.sport);
        
      correctionsCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `${correctionsCount} équipes différentes ont été renommées et fusionnées avec succès.` 
    });

  } catch (error: any) {
    console.error('Erreur Cron Clubs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}