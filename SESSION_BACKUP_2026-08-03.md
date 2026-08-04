# Backup de session — CardBulk (checklists, scanner, matching)

Résumé chronologique de tout ce qui a été fait dans cette session de travail, pour reprise ultérieure (nouvelle session, autre compte, ou simple mémoire).

---

## 1. Contexte de départ

Reprise après une session précédente ayant mis en place :
- Fiche joueur (`/joueur/[slug]`) avec stats Wikipedia
- Onglet Checklist dans `/collection` sourcé depuis `data/collections/` (fichiers statiques scrapés)

---

## 2. Crash de déploiement Vercel (1.28 Go)

**Symptôme** : build Vercel échoue, `/api/collection/import` dépasse 250 Mo (limite serverless).

**Cause** : `data/collections/` pèse **1,3 Go** (images + HTML bruts du scraping), et toute route API faisant un `fs.readFileSync` avec un chemin **dynamique** dans ce dossier fait que Vercel/`@vercel/nft` embarque tout le répertoire dans le bundle serverless.

**Solution retenue** : migrer toutes les données de collections vers **Supabase** (tables `collections` + `manual_collections`), plus aucune lecture disque dynamique dans les routes API.

### Tables Supabase créées

```sql
-- Collections globales (scrapées, ~200 au départ)
create table if not exists public.collections (
  folder     text primary key,
  catalog    jsonb not null,   -- {year, annee, editeur, publisher, serie, card_types, beckett_url}
  data       jsonb not null,   -- {fiche, checklist}
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create policy "Authenticated users can read collections"
  on public.collections for select using (auth.role() = 'authenticated');

-- Collections importées manuellement par l'utilisateur
create table if not exists public.manual_collections (
  folder     text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  catalog    jsonb not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.manual_collections enable row level security;
create policy "Users can view own manual collections" on public.manual_collections for select using (auth.uid() = user_id);
create policy "Users can insert own manual collections" on public.manual_collections for insert with check (auth.uid() = user_id);
create policy "Users can update own manual collections" on public.manual_collections for update using (auth.uid() = user_id);
create policy "Users can delete own manual collections" on public.manual_collections for delete using (auth.uid() = user_id);

-- Cache de progression (compteurs "cartes possédées" par collection)
create table if not exists public.checklist_progress_cache (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  counts          jsonb not null,
  cards_signature text not null,
  updated_at      timestamptz not null default now()
);
alter table public.checklist_progress_cache enable row level security;
create policy "Users can view own progress cache" on public.checklist_progress_cache for select using (auth.uid() = user_id);
create policy "Users can upsert own progress cache" on public.checklist_progress_cache for insert with check (auth.uid() = user_id);
create policy "Users can update own progress cache" on public.checklist_progress_cache for update using (auth.uid() = user_id);

-- Référence exacte carte -> collection (pour matching futur sans texte flou)
alter table public.cards add column if not exists collection_folder text;
create index if not exists idx_cards_collection_folder on public.cards (collection_folder);
```

### Script de migration one-shot
`scripts/migrate-collections-to-supabase.js` — lit `data/collections/*/collection.json` (199 fichiers) et pousse `{fiche, checklist}` uniquement (pas les images/stats/gemini_context) dans la table `collections`. Lancé avec succès : 199/199.

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:collections
```

### Bug d'authentification (401) découvert après coup
Les routes API utilisaient `createRouteHandlerClient({cookies})` (helpers Next.js basés cookies), mais l'app gère la session avec le client Supabase **classique** (`localStorage`) — jamais de cookies écrits. Résultat : routes toujours "Not authenticated".

**Fix** : nouveau `lib/supabaseServer.ts` — construit un client Supabase à partir d'un token **Bearer** envoyé explicitement dans le header `Authorization`. Toutes les routes utilisent maintenant `supabaseFromRequest(req)`. Côté client, un helper `authedFetch()` (dans `collection/page.tsx` et `scanner/page.tsx`) attache `Authorization: Bearer <access_token>` à chaque appel `fetch`.

### Cache HTTP
Ajout de `export const dynamic = 'force-dynamic'` + `revalidate = 0` + header `Cache-Control: no-store` sur toutes les routes API concernées, pour éviter qu'une collection supprimée/réimportée ne reste servie depuis un cache.

---

## 3. Sync automatique GitHub Actions

`scripts/sync-collections.js` mis à jour pour pousser directement vers Supabase (`pushToSupabase()`) après chaque scrape Beckett réussi. Nécessite les secrets GitHub `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

**Le cron hebdomadaire a été désactivé** (`.github/workflows/sync-collections.yml`, bloc `schedule` commenté) — l'utilisateur gère désormais ses checklists manuellement pour garder le contrôle total. Le déclenchement manuel (`workflow_dispatch`) reste disponible.

---

## 4. Import manuel de checklists (feature principale)

### Format template (`data/collections/_TEMPLATE/`)
```json
{
  "collection_id": "editeur-serie-ligue-annee-sport-cards",
  "fiche": {
    "annee": "2026 (avril)",
    "pays": "France",
    "editeur": "PANINI",
    "serie": "SELECT / SERIE A",
    "support": "Cartes",
    "version": "V.O. (version originale) en anglais",
    "contenu_global": "...",
    "dotation_boite": "..."
  },
  "checklist": [
    { "numero": "1", "joueur": "Prénom Nom", "mention": null, "subset": "BASE", "section": "TERRACE" }
  ]
}
```

**Règle critique** : `fiche.serie` doit être le nom **complet et distinctif** (ex: `"SELECT / SERIE A"`, pas juste `"SELECT"`) — sinon toutes les déclinaisons d'une même gamme s'affichent de façon identique.

### UI d'import (`app/collection/page.tsx`)
- Bouton "Importer un fichier .json" dans la modale "Nouvelle collection"
- **Drag & drop multi-fichiers**, jusqu'à **30 fichiers** à la fois, traités par lots de **6 en parallèle** (`IMPORT_CONCURRENCY`) pour ne pas saturer Supabase
- Écriture directe côté client dans `manual_collections` (upsert), pas de route API dédiée (supprimée — écrivait sur disque, incompatible avec Vercel)
- Après import : recalcul immédiat de la progression (`?refresh=1`, contourne le cache)

### Bouton Supprimer
- En haut à droite de la vue détail d'une collection, bouton rouge "Supprimer"
- Popin de confirmation : *"Es-tu sûr de vouloir supprimer la checklist "X" ?"* — **Oui** (rouge, gauche) / **Annuler** (vert, droite)
- Supprime la ligne de `manual_collections`

---

## 5. Affichage de l'onglet Checklist

- **Toutes les collections s'affichent**, possédées ou non (le filtre "masquer si vide" a été retiré à la demande de l'utilisateur — il veut pouvoir chercher "dans quelle collection se trouve quel joueur" même sans en posséder de carte)
- Badge vert (nombre de cartes possédées) affiché **seulement si > 0**
- **Nom affiché** : `formatCollectionIdWithoutBrand()` (dans `lib/checklistMatching.ts`) dérive un nom lisible et simplifié depuis le `collection_id`/`folder` — **toujours**, indépendamment de `fiche.serie` :
  - Retire la marque (déjà affichée séparément)
  - Retire les années/saisons (4 chiffres, format court "24-25")
  - Retire les mois en français
  - Retire le bruit de scraping (`soccer cards`, `trading cards`, `fiche signalétique avec check-list`, `précommande en...`, `coup d'œil avec check-list`...)
  - **Garde** tout le reste, y compris le pays
  - Exemple : `topps-match-attax-bundesliga-allemagne-2023-octobre-soccer-cards` → `Match Attax Bundesliga Allemagne`
- Coloration : le terme avant le "/" dans la série en jaune (`#AFFF25}`), le reste en blanc (uniquement pertinent quand `serie` contient un "/", rare maintenant vu le nom toujours dérivé du `collection_id`)
- Vignettes des cartes possédées (110px de haut) affichées sous les filtres dans la vue détail d'une collection

---

## 6. Calcul de la progression (badges "X cartes possédées")

**Historique des bugs** :
1. D'abord calculé côté client (fetch séquentiel de ~200 collections) → lent, "Calcul de ta progression..." à chaque ouverture
2. Déplacé côté serveur (`/api/checklist-progress`) + cache Supabase (`checklist_progress_cache`), invalidé par une signature (cartes + liste de collections)
3. Bug : importer une nouvelle collection sans changer ses cartes gardait l'ancien cache (signature basée uniquement sur les cartes) → corrigé en incluant aussi la liste des `folder` dans la signature
4. Bug d'auth 401 → corrigé via `supabaseFromRequest`
5. Bug de cache HTTP (route Next.js mise en cache) → corrigé via `force-dynamic` + `no-store`

Mis en cache en session via `sessionStorage` initialement, puis remplacé par le cache serveur (partagé entre appareils).

---

## 7. Matching checklist ↔ cartes possédées (`lib/checklistMatching.ts`)

Module central partagé entre :
- `app/api/checklist-progress/route.ts`
- `app/api/collection/route.ts`
- `app/collection/page.tsx` (vue détail, checkmarks joueur par joueur)
- `scripts/match-cards-to-checklists.js` (dupliqué en JS pur, pas de import TS dans un script Node)

### Fonctions exportées
- `normText(s)` — normalisation (minuscule, sans accents, alphanumérique seulement)
- `splitVariation(variation)` — découpe `"TYPE - RARETÉ"` ou `"TYPE / RARETÉ"` en `{type, name}`
- `detectSubsetCat(s)` — catégorise un subset : `BASE`, `INSERT`, `PARALLEL`, `AUTOGRAPH`, `RELIC`, `AUTOGRAPH_RELIC` (nouveau, cf. bug A+R ci-dessous)
- `cardMatchesSubset(subset, section, card)` — vérifie qu'une carte possédée correspond au type attendu
- `findMatchingCard(playerName, subset, section, colYear, colPub, colSerie, cards)` — trouve la carte possédée correspondant à une ligne de checklist
- `cardsSignature(cards)` — empreinte stable pour invalider un cache
- `formatCollectionIdWithoutBrand(collectionId)` — nom d'affichage simplifié (cf. section 5)

### Bugs de matching corrigés dans cette session
1. **Variation ignorée** : le matching ne regardait que `is_auto`/`is_patch`, jamais le champ `card.variation` (ex: `"INSERT - WONDERKIDS"`). Corrigé : `splitVariation()` + comparaison au `subset`/`section` du checklist.
2. **"A+R" non reconnu** : nouveau format découvert dans les fichiers enrichis (`sets_complet.json`), signifie Autograph+Relic combiné. Ajouté comme catégorie `AUTOGRAPH_RELIC` (mots-clés : `A+R`, `AUTOGRAPH RELIC`, `AUTOGRAPHED RELIC`, `AUTO RELIC`, `AUTO/RELIC`, `AUTOGRAPH(ED) MEMORABILIA`), exige **les deux** flags `is_auto` ET `is_patch`. Doit être détecté **avant** `AUTOGRAPH`/`RELIC` seuls (sinon "A+R" matche `AUTOGRAPH` en premier).
3. **Faux positif "Prized Footballers" / "Prized Footballers Fusion"** : le nom de rareté était comparé par **sous-chaîne** (`.includes()`), donc "Fusion" (qui contient "Prized Footballers" comme préfixe) validait aussi les cartes de base. Corrigé en **égalité stricte**, appliquée à **toutes** les catégories (pas seulement INSERT/PARALLEL comme avant).

---

## 8. Colonne `collection_folder` (référence exacte)

Ajoutée à `cards` (`alter table cards add column collection_folder text`) pour permettre, à terme, un matching par **égalité d'ID** plutôt que par texte approximatif. Remplie automatiquement par le script de migration ci-dessous quand un match fiable est trouvé.

---

## 9. Script de migration des cartes existantes

`scripts/match-cards-to-checklists.js` — pour chaque carte déjà en base :
1. Cherche des collections candidates (même éditeur + série approx. + année)
2. Vérifie que le **joueur** et le **subset/section** correspondent réellement (via `cardMatchesSubset`/`playerNameMatch`, miroir JS pur de `lib/checklistMatching.ts`)
3. Si match : prévoit de remplacer `brand`/`series`/`variation` par les valeurs canoniques du checklist + renseigne `collection_folder`
4. Si pas de match : liste dans `unmatched-cards-report.json` (joueur, club, collection actuelle, raison)

**Mode dry-run par défaut** (aucune écriture), `--apply` pour appliquer réellement. `--user=<uuid>` pour filtrer sur un seul utilisateur.

```bash
# Aperçu
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run match:cards
# Application réelle
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run match:cards -- --apply
```

**Dernier résultat obtenu** (dry-run, 3 août) : 352 cartes analysées, 444 collections disponibles → **56 matchées**, 0 déjà à jour, **296 sans correspondance**.

### ⚠️ Point toujours en investigation (non résolu)
Taux de match plus bas qu'attendu (56/352 ≈ 16%). Piste explorée : incohérence de comparaison d'année (égalité stricte dans le script vs comparaison souple ailleurs) — un correctif a été apporté mais **s'est avéré ne rien changer en pratique** (les deux valeurs étant déjà réduites à 4 chiffres propres par regex avant comparaison, l'"includes" ne peut être vrai que si elles sont déjà égales). Le code du fix est resté en place (inoffensif, juste inutile).

**Prochaine étape à reprendre** : lire `/Users/hugault.dauvois/Documents/GitHub/CardBulk2/unmatched-cards-report.json` (79 Ko, généré, présent sur disque) pour identifier les vrais motifs d'échec — la lecture a été entamée puis interrompue par l'utilisateur avant analyse. Hypothèses probables :
- Cartes d'autres sports que le foot (aucune checklist encore importée pour basketball/tennis/baseball/NFL/NHL)
- `brand`/`series` en texte libre saisis avant l'existence du système de checklists, ne correspondant à aucune collection importée
- Rareté/subset trop spécifique ne correspondant à aucune ligne de checklist (égalité stricte du fix section 7.3)

---

## 10. Remplacement des sélecteurs du scanner (`app/scanner/page.tsx`)

Objectif : les checklists importées deviennent la **seule source de vérité** pour le sport SOCCER (remplace `data/sets.json`), éliminant le besoin de matching flou entre deux systèmes séparés.

### `/api/subsets` (réécrite)
Lisait auparavant un fichier statique périmé `data/subsets-index.json` (dernière génération : 9 juillet, 189 collections). Réécrite pour interroger Supabase (`collections` + `manual_collections`) en direct — toujours à jour, aucune régénération manuelle nécessaire.

**Fix appliqué** : le filtre année est maintenant tolérant — si le filtre strict (marque + série + année) ne renvoie rien, retente automatiquement sans le critère année (le champ Année du formulaire scanner a une valeur par défaut qui ne correspond pas forcément à l'année réelle de la collection choisie, puisque le menu Collection/Set n'est pas filtré par année).

### Menus Marque / Collection-Set (pour SOCCER uniquement)
- Nouveau state `checklistCatalog` (éditeur/série/année, léger, sans checklist complet), chargé une fois au montage
- Pour `formData.sport === 'SOCCER'` : les menus **Marque** et **Collection/Set** viennent **exclusivement** de `checklistCatalog` (remplacement complet, pas de fusion avec `data/sets.json`) — décision prise après que l'utilisateur a signalé voir encore d'anciennes collections avec une logique de fusion additive initiale
- Autres sports (basketball, tennis, baseball, NFL, NHL) : restent sur `data/sets.json` (aucune checklist importée pour ces sports à ce stade)

### `data/sets.json` — corrections indépendantes
5 clés de sport invalides corrigées (ne correspondaient à aucune valeur reconnue par `SPORT_CONFIG`) :
| Marque | Ancienne clé | Nouvelle clé |
|---|---|---|
| Topps | `american_football` | `nfl` |
| Panini | `basketball_nba` | `basketball` |
| Panini | `american_football_nfl` | `nfl` |
| Upper Deck | `hockey` | `nhl` |
| Upper Deck | `multi_sport` | *supprimée* (doublon, gardé sous `football_soccer`) |

Fusion d'un fichier enrichi (`sets_complet.json`, 40 Mo) : `common_subsets` mis à jour pour le foot (66 sets enrichis, 34 nouveaux). Le champ `known_collections` (18,5 Mo, historique des éditions par set) a été **extrait séparément** dans `data/sets-known-collections.json` (non importé côté client) pour ne pas alourdir le bundle JS du scanner.

### Fusion des gammes Topps dans le menu Collection/Set
Constat de l'utilisateur : chez Topps, une même gamme (Finest, Match Attax, Chrome, Merlin, Deco, Museum...) ressort chaque année sous le même nom — seule l'année différencie les éditions, la partie après le "/" ne fait que lister la ou les compétitions couvertes cette année-là (ex: `"FINEST / UEFA CHAMPIONS LEAGUE"`, `"FINEST / UEFA EURO"` → doivent apparaître comme une seule option `"FINEST"`).

**Important** : cette règle est **scopée à Topps uniquement**. Chez Panini (Select/Prizm), une même gamme décline de vrais produits différents par championnat (`"SELECT / SERIE A"` ≠ `"SELECT / LA LIGA"`, checklists distinctes) — comportement volontairement préservé, corrigé exprès plus tôt dans la session pour éviter les doublons visuels.

Implémentation (`app/scanner/page.tsx`) : quand `formData.brand === 'TOPPS'`, le menu Collection/Set ne garde que le texte avant le premier "/" de chaque `serie` (`s.split('/')[0].trim()`), dédupliqué. Fonctionne aussi correctement pour préserver des gammes réellement distinctes comme "MATCH ATTAX EXTRA" (slash absent juste après "MATCH ATTAX", donc pas fusionné avec "MATCH ATTAX").

⚠️ Limite connue : 2 entrées scrapées mal formées ne se fusionnent pas (`"MATCH ATTAX UEFA CHAMPIONS LEAGUE / EUROPA LEAGUES : PREMIÈRES INFORMATIONS"`, `"MATCH ATTAX UEFA CLUB COMPETITIONS : MISES À JOUR"`) — ressemblent à des titres d'articles de scraping plutôt qu'à de vrais noms de collection (pas de "/" juste après "MATCH ATTAX"). À corriger à la source (champ `fiche.serie` de ces 2 checklists) plutôt que par du code, pour ne pas risquer de casser la distinction "Match Attax Extra". Proposition faite à l'utilisateur, pas encore traitée.

---

## 11bis. Édition manuelle des checklists importées

Nouveau bouton **"Modifier"** dans l'en-tête de la vue détail d'une collection — visible **uniquement** si la collection appartient à `manual_collections` (checklists importées par l'utilisateur). Les ~200 collections scrapées globales (table `collections`) restent en lecture seule (pas de policy d'écriture pour l'utilisateur dessus).

### Fonctionnement (`app/collection/page.tsx`)
- `buildDetailFromChecklist` conserve maintenant aussi le champ `numero` par joueur (nécessaire pour l'édition, était perdu avant)
- État `editMode` + `editChecklist` (copie de travail du tableau `checklist[]` brut, pas de la structure groupée en lecture seule)
- En mode édition : chaque ligne devient éditable (inputs N°, Nom du joueur, Mention) + bouton supprimer par ligne
- Bouton **"+ Ajouter une carte"** en bas de chaque groupe subset/section
- Bouton **"+ Ajouter un subset (catégorie)"** en haut — mini-formulaire (select BASE/INSERT/AUTOGRAPH/RELIC/MEMORABILIA/PARALLEL/OR/SPECIAL + nom de section libre) créant un nouveau groupe vide
- Boutons **Enregistrer** (vert, upsert `manual_collections.data`, filtre les lignes à joueur vide, recharge la collection + recalcule la progression) / **Annuler** remplacent les boutons habituels (Modifier/XLSX/Supprimer) pendant l'édition

**Non testé en conditions réelles** (pas d'environnement Supabase valide dans le sandbox de dev) — à vérifier par l'utilisateur : ouvrir une checklist importée, Modifier, ajouter/modifier/supprimer des lignes, Enregistrer, vérifier la persistance après rechargement.

---

## 11. Fichiers créés/modifiés (résumé)

### Nouveaux fichiers
- `lib/checklistMatching.ts` — matching partagé
- `lib/supabaseServer.ts` — client Supabase authentifié par Bearer token
- `app/api/checklist-progress/route.ts`
- `scripts/migrate-collections-to-supabase.js`
- `scripts/match-cards-to-checklists.js`
- `data/collections/_TEMPLATE/collection.json` + `README.md`
- `data/sets-known-collections.json` (18,5 Mo, non versionné côté client)

### Fichiers significativement modifiés
- `app/api/collection/route.ts` — Supabase au lieu du disque
- `app/api/subsets/route.ts` — Supabase au lieu du fichier statique, fallback année tolérant
- `app/collection/page.tsx` — import multi-fichiers, suppression, affichage simplifié, cache progression, **édition manuelle des checklists** (section 11bis)
- `app/scanner/page.tsx` — sélecteurs Marque/Set/Subset checklist-driven pour SOCCER, **fusion des gammes Topps** (section 10)
- `lib/checklistMatching.ts` — catégorie `AUTOGRAPH_RELIC` ("A+R"), égalité stricte nom/section, `formatCollectionIdWithoutBrand` simplifié (années/mois/bruit retirés)
- `scripts/match-cards-to-checklists.js` — comparaison d'année alignée (sans effet mesuré, cf. section 9)
- `scripts/sync-collections.js` — push Supabase après scrape
- `.github/workflows/sync-collections.yml` — cron désactivé
- `data/sets.json` — clés de sport corrigées + subsets enrichis
- `package.json` — scripts `migrate:collections`, `match:cards`

### Supprimés
- `app/api/collection/import/route.ts` (écrivait sur disque, cause du crash 1,28 Go)

---

## 12. Points de sécurité rencontrés

La clé `SUPABASE_SERVICE_ROLE_KEY` a été **exposée en clair dans le chat à plusieurs reprises** (captures d'écran de terminal). Recommandation donnée à chaque fois : **régénérer la clé** dans Supabase (Project Settings → API Keys → Revoke/Regenerate) et mettre à jour Vercel. À vérifier si c'est fait.

---

## 13. État des commits Git

Plusieurs vagues de changements ont été committées et pushées **par l'utilisateur lui-même** en cours de route (commits `5ac76fd`, `d0ac675`, `bb7bdff`, `fc81782`, etc.) — Claude n'a pas poussé automatiquement (règle : toujours demander confirmation avant push). **Au moment de la coupure de cette session, aucun des changements suivants n'était encore commité** — à vérifier avec `git status` en reprise :
- Fix "A+R" + égalité stricte nom/section (`lib/checklistMatching.ts`)
- `formatCollectionIdWithoutBrand` simplifié (retrait années/mois/bruit de scraping)
- Colonne `collection_folder` (SQL fourni, à exécuter séparément — pas un fichier de code)
- Fix comparaison d'année dans `scripts/match-cards-to-checklists.js`
- Fusion des gammes Topps dans `app/scanner/page.tsx`
- Édition manuelle des checklists dans `app/collection/page.tsx`

---

## 14. Prochaines étapes à la reprise

1. Lire `unmatched-cards-report.json` (déjà généré sur disque, lecture interrompue) pour comprendre les 296 cartes non matchées
2. Décider si le taux de match (56/352) est acceptable ou s'il faut ajuster la logique de matching du script
3. Corriger à la source (ou trancher de laisser tel quel) les 2 entrées Topps Match Attax mal formées (fiche.serie ressemblant à des titres d'articles)
4. Tester en conditions réelles le nouveau mode édition des checklists (section 11bis) — jamais testé faute d'environnement Supabase dans le sandbox
5. Vérifier `git status` et commit/push si nécessaire
6. Vérifier que la clé `SUPABASE_SERVICE_ROLE_KEY` a bien été régénérée (exposée plusieurs fois dans le chat)
7. Poursuivre l'import des ~400 collections restantes
8. Une fois le matching stabilisé, lancer `npm run match:cards -- --apply` pour de vrai
