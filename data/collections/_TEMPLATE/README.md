# Modèle de checklist — `collection.json`

Pour ajouter une collection manuellement, copie `collection.json` dans un nouveau dossier
`data/collections/<folder-slug>/collection.json`, puis ajoute une entrée correspondante
dans `data/collections/collections_catalog.json`.

## 1. Nom du dossier (`folder-slug`)

Kebab-case, unique : `editeur-serie-ligue-annee-sport-cards`
Exemple : `panini-select-serie-a-2025-26-soccer-cards`

## 2. Champs de `fiche` (obligatoires : `annee`, `editeur`, `serie`)

| Champ | Rôle | Règle importante |
|---|---|---|
| `annee` | Affiché en petit, ligne 1 | Format libre : `"2026 (avril)"` ou juste `"2026"` |
| `editeur` | Affiché en petit, ligne 1 | `PANINI`, `TOPPS`, `FUTERA`... en majuscules |
| `serie` | Affiché en grand, ligne 2 | **⚠️ Doit être le nom COMPLET et distinctif**, pas juste la gamme générique. Ex : `"SELECT / SERIE A"` et non `"SELECT"` — sinon toutes les déclinaisons (Serie A, La Liga, Premier League...) d'une même gamme s'affichent de façon identique dans la liste. |
| `pays`, `support`, `version`, `contenu_global`, `dotation_boite` | Optionnels, informatifs | `contenu_global`/`dotation_boite` s'affichent dans un encart sur la fiche détail |

## 3. Champs de chaque ligne de `checklist[]`

| Champ | Rôle |
|---|---|
| `numero` | Numéro de la carte dans le set (string) |
| `joueur` | Nom complet du joueur — sert au matching avec ta collection |
| `mention` | Optionnel : `"Rookie Card"`, `"Future Stars"`... affiché en badge |
| `subset` | Catégorie de la carte — sert à regrouper l'affichage ET à vérifier le bon type de carte possédée (voir ci-dessous) |
| `section` | Sous-catégorie / nom du parallèle ou de l'insert (ex. `"TERRACE"`, `"JUMBO SWATCHES"`) |

### Valeurs de `subset` reconnues pour le matching auto/relic

L'app compare le `subset` de chaque ligne aux specs de tes cartes possédées (`is_auto`, `is_patch`) :

- `subset` contient **AUTOGRAPH** ou **AUTO** → la carte possédée doit être cochée "Autographe"
- `subset` contient **RELIC**, **MEMORABILIA**, **JERSEY**, **SWATCH** ou **PATCH** → la carte doit être cochée "Patch"
- `subset` exactement **BASE** → la carte ne doit être ni auto ni patch
- Toute autre valeur (nom de gamme produit : `PRIZM`, `SELECT`, `ABSOLUTE`...) → aucune contrainte de type imposée

Utilise ces mots-clés dans `subset` autant que possible pour bénéficier de la vérification automatique.

## 4. Entrée à ajouter dans `collections_catalog.json`

```json
{
  "folder": "editeur-serie-ligue-annee-sport-cards",
  "year": 2026,
  "annee": "2026 (avril)",
  "editeur": "PANINI",
  "publisher": "PANINI",
  "serie": "SELECT / SERIE A",
  "card_types": [],
  "beckett_url": ""
}
```

- `year` : entier, utilisé pour le tri et le filtre par année
- `serie` doit être **identique** au `fiche.serie` du `collection.json` (même règle : nom complet)
- `card_types` : peut rester vide `[]`, uniquement utilisé en fallback si aucune checklist n'existe

## 5. Checklist visible seulement si tu possèdes au moins une carte

Une collection n'apparaît dans l'onglet Checklist que si au moins une de tes cartes
(`brand` + `series` + `year`) correspond à `editeur` + `serie` + `annee` de la fiche.
Ce n'est pas lié au `checklist[]` — uniquement à ta collection de cartes existante.
