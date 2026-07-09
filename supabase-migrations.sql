-- ============================================================
-- MIGRATIONS SUPABASE — CardBulk2
-- À exécuter dans Supabase > SQL Editor avant le push
-- ============================================================

-- -----------------------------------------------------------
-- 1. scan_examples : few-shot learning pour le scanner IA
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_examples (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  brand text,
  series text,
  variation text,
  sport text,
  year text,
  is_auto boolean DEFAULT false,
  is_patch boolean DEFAULT false,
  is_rookie boolean DEFAULT false,
  is_numbered boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_examples_user_id ON scan_examples(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_examples_brand_series ON scan_examples(brand, series);
CREATE INDEX IF NOT EXISTS idx_scan_examples_created_at ON scan_examples(user_id, created_at DESC);

ALTER TABLE scan_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_examples_select" ON scan_examples
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "scan_examples_insert" ON scan_examples
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scan_examples_delete" ON scan_examples
  FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------
-- 2. custom_subsets : variations saisies manuellement
--    Quand un utilisateur ajoute une variation via "Autre",
--    elle est sauvegardée ici et réapparaît dans le dropdown
--    pour les prochains scans de la même marque/série.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_subsets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand text NOT NULL,
  series text NOT NULL,
  variation text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, brand, series, variation)
);

CREATE INDEX IF NOT EXISTS idx_custom_subsets_user_brand_series ON custom_subsets(user_id, brand, series);

ALTER TABLE custom_subsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_subsets_select" ON custom_subsets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "custom_subsets_insert" ON custom_subsets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_subsets_delete" ON custom_subsets
  FOR DELETE USING (auth.uid() = user_id);
