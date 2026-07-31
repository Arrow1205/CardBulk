# CardBulk — Documentation projet (pour migration de compte Claude)

Application de gestion de collection de cartes à collectionner (foot, basket, baseball, NFL, NHL), avec scanner de cartes, base de données Supabase, checklists de collections Panini/Topps, et fiches statistiques joueurs.

## Stack technique

- **Next.js 14** (App Router), TypeScript, Tailwind CSS
- **Supabase** : auth + base de données (Postgres) + stockage
- **Vercel** : hébergement + cron jobs
- **GitHub Actions** : scraping hebdomadaire automatisé
- Design system : fond `#040221`, accent `#AFFF25` (vert néon), typographie italique/black uppercase

Repo GitHub : `Arrow1205/CardBulk`

## Arborescence des pages (`app/`)

| Route | Rôle |
|---|---|
| `/` | Accueil |
| `/login`, `/auth/callback` | Authentification Supabase |
| `/collection` | Onglet principal : Cartes / Dossiers / Checklist (3 sous-onglets) |
| `/collection/[pseudo]` | Vitrine publique partageable (QR code) |
| `/card/[id]` | Détail d'une carte |
| `/modifier/[id]` | Édition d'une carte |
| `/scanner` | Scan photo d'une carte → extraction IA des infos → sauvegarde |
| `/joueur/[slug]` | Fiche joueur : cartes possédées + stats de carrière (Wikipedia) |
| `/club/[slug]` | Cartes filtrées par club |
| `/player/[id]`, `/sport/[id]` | Vues alternatives par joueur/sport |
| `/wishlist` | Liste de souhaits |
| `/stats` | Statistiques globales de la collection |
| `/settings` | Paramètres utilisateur (pseudo, etc.) |
| `/admin/clean-db` | Outils de nettoyage DB (admin) |

## Modèle de données Supabase

Pas de table "collection" dédiée : une collection = toutes les lignes `cards` d'un `user_id`.

```
cards
├── id, user_id (FK auth.users)
├── sport (SOCCER/BASKETBALL/BASEBALL/NFL/NHL), firstname, lastname
├── brand, series, variation, year
├── club_name, player_id (FK players)
├── is_rookie, is_auto, is_patch, is_numbered, numbering_low, numbering_max
├── purchase_price, image_url, image_url_back, is_horizontal
├── is_wishlist (bool — distingue collection/wishlist), is_favorite
├── folder_id (FK folders)
├── is_graded, grading_company, grading_grade
└── created_at, updated_at

folders          — dossiers/classeurs (name, type, user_id, is_favorite)
profiles         — profil utilisateur (pseudo pour la vitrine publique)
card_prices      — historique de prix par carte (via eBay)
players          — référentiel joueurs (+ relation clubs)
custom_subsets   — variations de sous-sets non reconnues, apprises depuis le scanner
scan_examples    — exemples de scans pour améliorer la reconnaissance IA
player_stats_cache — cache des stats joueur (voir plus bas), clé = slug, TTL 7 jours
```

**Script SQL pour recréer `player_stats_cache`** (si nouvelle instance Supabase) :
```sql
create table if not exists public.player_stats_cache (
  slug        text        primary key,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_player_stats_cache_updated
  on public.player_stats_cache (updated_at);
```

## Variables d'environnement (Vercel)

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Écritures serveur (cache stats, cron) |
| `GEMINI_API_KEY` | IA scanner (extraction infos carte depuis photo) + scraping Beckett |
| `EBAY_APP_ID`, `EBAY_CERT_ID` | Cotation prix des cartes (eBay) |
| `SCRAPER_API_KEY` | Proxy de scraping pour le sync Beckett |
| `CRON_SECRET` | Protection des routes `/api/cron/*` |

## Fonctionnalités principales

### 1. Scanner de cartes (`/scanner`, `app/api/scan/route.ts`)
Photo → recadrage/ajustement → extraction IA (Gemini) des métadonnées (joueur, marque, série, année, specs) → sauvegarde dans `cards`. Apprend les nouvelles variations dans `custom_subsets`.

### 2. Fiche joueur (`/joueur/[slug]`, `app/api/player-stats/route.ts`)
**Historique important** : plusieurs sources de stats ont été testées (api-football, SofaScore — bloqué par Cloudflare même via Worker proxy —, FotMob, scraping Transfermarkt, Gemini). La solution retenue et actuelle : **parsing direct du wikitext Wikipedia** (aucune IA dans le pipeline final — Gemini a été retiré car il répondait depuis sa connaissance figée au lieu de lire les données fournies).

Pipeline actuel :
1. Recherche Wikipedia (`action=query&list=search`)
2. Repérage des sections "Career statistics > Club" et "> International" + "Honours"
3. Récupération du wikitext (`action=parse&prop=wikitext`)
4. Parsing regex des tableaux wiki (format `{|...|}`, lignes `|-`, totaux en `!...!!`)
5. Photo/nationalité/poste via TheSportsDB (API gratuite, clé publique `3`)
6. Cache Supabase (`player_stats_cache`, TTL 7 jours) — bypass avec `?refresh=1`

Données exposées : `currentSeason` (saison en cours), `clubCareer[]` (cumul par club), `intlCareer[]` (cumul sélection nationale), `careerTotal`, `trophies` (`{leagues, cups, international[]}`).

UI : CTA "Mise à jour des données" qui force le refresh, palmarès en grille (2 cols mobile / 4 desktop), logos clubs/nations depuis `/asset/logo-club/foot/[slug].svg` (masqués silencieusement si absents).

### 3. Checklists de collections (`/collection` → onglet Checklist)
**Source de données : `data/collections/<folder>/collection.json`** (~200 sets Panini/Topps scrapés depuis Beckett.com), catalogués dans `data/collections/collections_catalog.json`.

Format d'un `collection.json` :
```json
{
  "collection_id": "...",
  "fiche": { "annee", "pays", "editeur", "serie", "contenu_global", "dotation_boite" },
  "subsets": [{ "subset": "BASE", "section": "TERRACE", "description": null }],
  "checklist": [{ "numero": "1", "joueur": "...", "mention": null, "subset": "BASE", "section": "TERRACE" }],
  "cartes_rares": [...], "images": [...], "stats": {...}, "gemini_context": {...}
}
```

`app/api/collection/route.ts` sert ces fichiers en lecture directe (par nom de dossier). Côté front, `checklist[]` est regroupé à la volée en `subsets[].players[]` (fonction `buildDetailFromChecklist`) pour matcher l'UI existante (accordéons par catégorie/section, statut possédé/manquant via matching nom+année+marque+série avec les `cards` de l'utilisateur).

Fallback : pour les ~38 sets sans `checklist` scrapé, import manuel d'un fichier XLSX Beckett possible (stocké en `localStorage`, clé `checklist_override_<folder>`).

**Sync automatique** : `scripts/sync-collections.js` (déclenché chaque vendredi 9h UTC via `.github/workflows/sync-collections.yml`) scrape la catégorie Beckett Soccer, détecte les nouveaux articles de collection, parse le HTML, appelle Gemini une fois par article pour structurer les métadonnées, et commit les nouveaux `collection.json` + met à jour le catalogue.

### 4. Cotation prix (`app/api/price-update/route.ts`, `app/api/cron/price-update/route.ts`)
Récupère les prix moyens de vente eBay pour les cartes, historisé dans `card_prices`. Cron Vercel.

### 5. Dossiers / vitrine publique
Regroupement de cartes en dossiers (`folders`), partage d'une collection en lecture seule via `/collection/[pseudo]` (QR code, masque les prix d'achat).

## Points d'attention / dette connue

- `app/api/scout/route.ts` (chatbot IA sur la collection) utilise encore l'ancien modèle Gemini déprécié — désactivé côté UI (`app/collection/page.tsx`, code commenté autour de `handleAskAI`/`hasStartedScouty`).
- Le SDK `@google/generative-ai` est en v0.24.1 (API v1beta) — `gemini-2.5-flash` est le seul modèle confirmé fonctionnel à ce jour, `gemini-1.5-flash` et `gemini-2.0-flash` renvoient 404.
- SofaScore est **totalement inutilisable** (403 depuis Vercel, navigateur, et Cloudflare Worker) — ne pas retenter cette piste pour les stats joueur.
- api-football.com (plan gratuit) est plafonné à la saison 2024/25 — insuffisant pour des stats à jour, d'où le choix Wikipedia.
- `.claude/launch.json` du repo lance `npm run dev` sur le port 3000 pour la preview locale.

## Historique des décisions clés

1. Stats joueur : api-football → SofaScore (échec total) → FotMob → Transfermarkt (échec, rendu client-side) → Gemini+Wikipedia (échec, Gemini ignore les données fournies) → **Wikipedia pur (regex) + cache Supabase** (solution actuelle).
2. Checklists collection : import manuel XLSX Beckett → **scraping automatisé Beckett + parsing wikitext-like du HTML**, stocké en JSON statique versionné dans le repo (`data/collections/`), avec sync GitHub Actions hebdomadaire.
