import { formatYearForEbay } from './ebay-utils';

function cleanData(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[^\w\s\-\/]/g, '').trim();
}

function extractSubsetName(variation: string): string {
  if (!variation) return '';
  return variation.split('/')[0].trim();
}

export function buildEbayKeywords(card: {
  firstname?: string;
  lastname?: string;
  brand?: string;
  series?: string;
  variation?: string;
  year?: string | number;
  sport?: string;
  is_numbered?: boolean;
  numbering_max?: string | number | null;
  is_graded?: boolean;
  grading_grade?: string | null;
}): string {
  const annee   = formatYearForEbay(cleanData(card.year), cleanData(card.sport), cleanData(card.brand));
  const brand   = cleanData(card.brand);
  const rawSerie = cleanData(card.series);
  const serie   = rawSerie.toUpperCase().startsWith(brand.toUpperCase() + ' ')
    ? rawSerie.slice(brand.length + 1).trim()
    : rawSerie;
  const prenom    = cleanData(card.firstname);
  const nom       = cleanData(card.lastname);
  const variation = extractSubsetName(cleanData(card.variation || ''));
  const numero    = card.is_numbered && card.numbering_max ? `/${cleanData(card.numbering_max)}` : '';
  const grade     = card.is_graded && card.grading_grade ? `PSA ${cleanData(card.grading_grade)}` : '';
  return [annee, brand, serie, prenom, nom, variation, numero, grade].filter(Boolean).join(' ');
}
