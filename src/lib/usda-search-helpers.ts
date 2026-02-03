/**
 * USDA Search Helpers
 *
 * Three-layer pipeline to improve USDA food search quality:
 * 1. Pre-search: spell correction + non-food token stripping
 * 2. Post-search: fuzzy re-ranking with Jaro-Winkler + token overlap
 * 3. Fallback: multi-query when initial results are poor
 */

// ============================================
// Layer 1: Pre-search query cleanup
// ============================================

const FOOD_SPELLING_CORRECTIONS: Record<string, string> = {
  // Peppers
  jalopeno: 'jalapeno',
  jalapino: 'jalapeno',
  jalepenio: 'jalapeno',
  jalepeno: 'jalapeno',
  // Cheese
  parmesean: 'parmesan',
  parmasean: 'parmesan',
  parmasan: 'parmesan',
  parmezan: 'parmesan',
  mozerella: 'mozzarella',
  mozarella: 'mozzarella',
  // Vegetables
  brocoli: 'broccoli',
  brocolli: 'broccoli',
  calliflower: 'cauliflower',
  califlower: 'cauliflower',
  cauliflour: 'cauliflower',
  zuchini: 'zucchini',
  zuchinni: 'zucchini',
  zuccini: 'zucchini',
  letuce: 'lettuce',
  lettuse: 'lettuce',
  tomatoe: 'tomato',
  potatoe: 'potato',
  potatos: 'potatoes',
  tomatos: 'tomatoes',
  aspargus: 'asparagus',
  asperagus: 'asparagus',
  artichoak: 'artichoke',
  // Fruits
  avacado: 'avocado',
  avacodo: 'avocado',
  avocato: 'avocado',
  bannana: 'banana',
  bananana: 'banana',
  straberry: 'strawberry',
  strwaberry: 'strawberry',
  strawbery: 'strawberry',
  blueburry: 'blueberry',
  bluberry: 'blueberry',
  raspbery: 'raspberry',
  rasberry: 'raspberry',
  pommegranate: 'pomegranate',
  pomegranite: 'pomegranate',
  pinapple: 'pineapple',
  pineaple: 'pineapple',
  watermelen: 'watermelon',
  watermellon: 'watermelon',
  cantalope: 'cantaloupe',
  cantelope: 'cantaloupe',
  // Grains / pasta
  spagehtti: 'spaghetti',
  spagetti: 'spaghetti',
  spageti: 'spaghetti',
  fetuccine: 'fettuccine',
  fettucine: 'fettuccine',
  tortila: 'tortilla',
  tortillia: 'tortilla',
  qinoa: 'quinoa',
  quiona: 'quinoa',
  // Condiments / sauces
  guacomole: 'guacamole',
  guacamoly: 'guacamole',
  mayonaise: 'mayonnaise',
  mayonase: 'mayonnaise',
  mayonaize: 'mayonnaise',
  katchup: 'ketchup',
  ketsup: 'ketchup',
  mustared: 'mustard',
  // Spices
  tumeric: 'turmeric',
  cinamon: 'cinnamon',
  cinimon: 'cinnamon',
  cinnimon: 'cinnamon',
  oregeno: 'oregano',
  origano: 'oregano',
  // Proteins
  salman: 'salmon',
  samon: 'salmon',
  // Dairy
  yogart: 'yogurt',
  yougurt: 'yogurt',
  yoghert: 'yogurt',
  // Misc
  sandwhich: 'sandwich',
  sandwitch: 'sandwich',
  caeser: 'caesar',
  ceasar: 'caesar',
  protien: 'protein',
  maccaroni: 'macaroni',
  macoroni: 'macaroni',
  edamame: 'edamame',
  hummos: 'hummus',
  humas: 'hummus',
  humus: 'hummus',
};

/**
 * Tokens that are store/brand names or filler words unlikely to help USDA search.
 * Stripped before sending query to USDA.
 */
const NON_FOOD_TOKENS = new Set([
  'harmons',
  "harmon's",
  'costco',
  'kirkland',
  'trader',
  "joe's",
  "trader's",
  'kroger',
  'safeway',
  'walmart',
  'aldi',
  'wegmans',
  'publix',
  'target',
  'sams',
  "sam's",
  'brand',
  'store',
  'generic',
]);

/**
 * Correct common food misspellings in a search query.
 * Operates token-by-token to avoid partial replacements inside longer words.
 */
export function correctSpelling(query: string): string {
  const tokens = query.toLowerCase().trim().split(/\s+/);
  const corrected = tokens.map(
    (token) => FOOD_SPELLING_CORRECTIONS[token] || token
  );
  return corrected.join(' ');
}

/**
 * Remove store/brand name tokens that won't match anything in USDA.
 * Never returns an empty string — falls back to original query if all tokens are stripped.
 */
export function stripNonFoodTokens(query: string): string {
  const tokens = query.toLowerCase().trim().split(/\s+/);
  const filtered = tokens.filter((t) => !NON_FOOD_TOKENS.has(t));
  return filtered.length > 0 ? filtered.join(' ') : query;
}

/**
 * Full pre-search cleanup: correct spelling, then strip non-food tokens.
 */
export function preprocessQuery(query: string): string {
  return stripNonFoodTokens(correctSpelling(query));
}

// ============================================
// Layer 2: Fuzzy re-ranking
// ============================================

/**
 * Jaro-Winkler string similarity (0.0 to 1.0).
 * Pure implementation — no external dependencies.
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler prefix bonus (up to 4 characters, scaling factor 0.1)
  let prefixLength = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefixLength++;
    else break;
  }

  return jaro + prefixLength * 0.1 * (1 - jaro);
}

export interface ScoredResult<T> {
  item: T;
  fuzzyScore: number;
}

/**
 * Score and sort results by fuzzy relevance to the query.
 *
 * Scoring: 70% token overlap (fraction of query tokens that fuzzy-match the
 * result description) + 30% full-string Jaro-Winkler similarity.
 */
export function scoreResults<T>(
  results: T[],
  queryTokens: string[],
  getDescription: (item: T) => string
): ScoredResult<T>[] {
  return results
    .map((item) => {
      const desc = getDescription(item).toLowerCase();
      const descTokens = desc.split(/[\s,\-()]+/).filter(Boolean);

      // Token overlap: what fraction of query tokens appear in the description
      let tokenMatchCount = 0;
      for (const qt of queryTokens) {
        const hasMatch = descTokens.some(
          (dt) =>
            dt.includes(qt) || qt.includes(dt) || jaroWinkler(qt, dt) > 0.85
        );
        if (hasMatch) tokenMatchCount++;
      }
      const tokenOverlap =
        queryTokens.length > 0 ? tokenMatchCount / queryTokens.length : 0;

      // Full-string similarity
      const fullJW = jaroWinkler(queryTokens.join(' '), desc);

      const fuzzyScore = tokenOverlap * 0.7 + fullJW * 0.3;

      return { item, fuzzyScore };
    })
    .sort((a, b) => b.fuzzyScore - a.fuzzyScore);
}

// ============================================
// Layer 3: Fallback multi-query
// ============================================

/** Minimum fuzzy score to consider results "good enough" (no fallback needed). */
export const FUZZY_THRESHOLD = 0.4;

/**
 * Generate alternative queries by dropping one token at a time.
 * Only useful when the query has 2+ tokens.
 * Returns at most 3 alternatives, prioritizing dropping the first token
 * (often a brand/store name that survived the non-food filter).
 */
export function generateFallbackQueries(tokens: string[]): string[] {
  if (tokens.length < 2) return [];

  const queries: string[] = [];
  for (let i = 0; i < tokens.length && queries.length < 3; i++) {
    const reduced = tokens.filter((_, idx) => idx !== i).join(' ');
    if (reduced.length >= 2) {
      queries.push(reduced);
    }
  }
  return queries;
}
