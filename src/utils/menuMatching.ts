/**
 * Menu item name normalization & matching.
 *
 * The client that sends us orders often spells the same dish slightly
 * differently ("Teriyaki Chicken with Steamed Vegetables" vs
 * "Teriyaki chicken with Veg Gratin"). This module maps those free-text names
 * onto the canonical names from our own menu (the Menu Prices file) using a
 * hybrid strategy:
 *
 *   1. Exact match (case/space/punctuation-insensitive) against a menu name.
 *   2. A stored alias the user has previously confirmed.
 *   3. Otherwise: unmatched — surfaced for human review, with fuzzy
 *      suggestions to make confirming a mapping one click.
 *
 * Nothing here auto-merges names: similarity only *suggests*. A variant is only
 * tied to a canonical menu item once a human confirms it (saved as an alias).
 */

/** Map of normalized variant name -> canonical menu display name. */
export type AliasMap = Record<string, string>;

export type MatchType = 'exact' | 'alias' | 'none';

export interface ResolveResult {
  /** Canonical menu name when matched/aliased; otherwise the trimmed input. */
  canonical: string;
  matchType: MatchType;
}

export interface Suggestion {
  name: string;
  /** Similarity score in [0, 1]. */
  score: number;
}

/** Words too generic to carry meaning when comparing dish names. */
const STOPWORDS = new Set([
  'with', 'in', 'and', 'the', 'of', 'a', 'an', 'on', 'served', 'side',
  '&', 'plus', 'topped', 'w', 'wt',
]);

/**
 * Normalize a name for comparison/keying: lowercase, strip punctuation,
 * collapse whitespace. Preserves all words (used for exact-match keys).
 */
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

/** Meaningful tokens of a name, with stopwords removed (used for similarity). */
function contentTokens(name: string): string[] {
  return normalizeItemName(name)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Character-bigram set of a token, for typo-tolerant comparison. */
function bigrams(token: string): Set<string> {
  const set = new Set<string>();
  if (token.length === 1) {
    set.add(token);
    return set;
  }
  for (let i = 0; i < token.length - 1; i++) set.add(token.slice(i, i + 2));
  return set;
}

function diceSets<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/**
 * Similarity in [0, 1] between two dish names. Combines a token-set Dice
 * coefficient (handles reordered / extra words) with a character-bigram Dice
 * over the joined tokens (handles minor typos / plural forms).
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = contentTokens(a);
  const tb = contentTokens(b);

  const tokenScore = diceSets(new Set(ta), new Set(tb));

  const biA = new Set<string>();
  for (const t of ta) for (const g of bigrams(t)) biA.add(g);
  const biB = new Set<string>();
  for (const t of tb) for (const g of bigrams(t)) biB.add(g);
  const charScore = diceSets(biA, biB);

  // Token overlap is the stronger signal; bigrams smooth over small spelling
  // differences.
  return 0.7 * tokenScore + 0.3 * charScore;
}

/**
 * Resolve a raw client-supplied name to a canonical menu name.
 * `menuNames` are the canonical display names from the Menu Prices file.
 */
export function resolveCanonical(
  rawName: string,
  menuNames: string[],
  aliasMap: AliasMap,
): ResolveResult {
  const trimmed = rawName.trim();
  const norm = normalizeItemName(trimmed);

  if (!norm) return { canonical: trimmed, matchType: 'none' };

  // 1. Exact (normalized) match against the menu.
  for (const m of menuNames) {
    if (normalizeItemName(m) === norm) {
      return { canonical: m.trim(), matchType: 'exact' };
    }
  }

  // 2. Confirmed alias.
  const aliased = aliasMap[norm];
  if (aliased) return { canonical: aliased, matchType: 'alias' };

  // 3. Unmatched — keep the original for display/review.
  return { canonical: trimmed, matchType: 'none' };
}

/**
 * Ranked canonical-name suggestions for an unmatched raw name.
 * Only returns candidates above `minScore`, best first.
 */
export function suggestCanonical(
  rawName: string,
  menuNames: string[],
  topN = 3,
  minScore = 0.3,
): Suggestion[] {
  return menuNames
    .map((name) => ({ name, score: nameSimilarity(rawName, name) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/** Add/replace a confirmed alias (returns a new map; does not mutate). */
export function addAlias(aliasMap: AliasMap, variant: string, canonical: string): AliasMap {
  const key = normalizeItemName(variant);
  if (!key) return aliasMap;
  return { ...aliasMap, [key]: canonical.trim() };
}

/** Remove an alias by its (raw or normalized) variant key. */
export function removeAlias(aliasMap: AliasMap, variant: string): AliasMap {
  const key = normalizeItemName(variant);
  if (!(key in aliasMap)) return aliasMap;
  const next = { ...aliasMap };
  delete next[key];
  return next;
}
