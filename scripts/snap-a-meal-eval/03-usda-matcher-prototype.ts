/**
 * Snap-a-Meal evaluation: USDA matcher prototype on a hand-picked
 * 20-ingredient probe set.
 *
 * Why this exists: the accuracy improvement plan proposes replacing
 * LLM-generated macros with USDA FDC lookups. Before betting Phase 1
 * on that swap, we need to know whether the existing matcher
 * (src/lib/usda-matching-service.ts) actually picks the right entry on
 * realistic inputs — specifically:
 *   - cooked vs raw distinction (raw chicken is ~30% leaner than roasted)
 *   - Foundation vs SR Legacy vs Branded preference
 *   - synonym handling ("ground turkey" → "Turkey, ground, raw"?)
 *   - hard-to-disambiguate cases ("rice" alone — white? brown? cooked?)
 *
 * Output: scripts/snap-a-meal-eval/fixtures/usda-prototype-results.json
 *         + a printed pass/concern table to stdout.
 *
 * Run:
 *   USDA_API_KEY=... ANTHROPIC_API_KEY=... npx tsx \
 *     scripts/snap-a-meal-eval/03-usda-matcher-prototype.ts
 */

import { writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBestUSDAMatch } from '@/lib/usda-matching-service';

async function loadEnvFile(path: string): Promise<void> {
  try {
    const raw = await readFile(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // missing file is fine
  }
}

const envFile = process.env.SUPABASE_ENV_FILE ?? '.env';
await loadEnvFile(envFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, 'fixtures/usda-prototype-results.json');

// ---------- probe set -----------------------------------------------------
// Each probe declares an `expectation` against which we score the match.
// `expectation.descriptionContains` are substrings the USDA description
// SHOULD contain; `descriptionRejects` are substrings that mark a wrong
// pick (e.g. raw when we expected cooked).

interface Probe {
  ingredient: string;
  servingSize?: number;
  servingUnit?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  expectation: {
    descriptionContains?: string[];
    descriptionRejects?: string[];
    preferredDataTypes?: string[];
    notes?: string;
  };
}

const PROBES: Probe[] = [
  // --- easy: whole foods, name-matches-USDA ---
  {
    ingredient: 'grilled chicken breast',
    servingSize: 6,
    servingUnit: 'oz',
    difficulty: 'easy',
    expectation: {
      descriptionContains: ['chicken', 'breast'],
      descriptionRejects: ['skin'],
      preferredDataTypes: ['Foundation', 'SR Legacy'],
      notes: 'Cooked variant preferred; meat-only beats with-skin.',
    },
  },
  {
    ingredient: 'broccoli',
    difficulty: 'easy',
    expectation: {
      descriptionContains: ['broccoli'],
      preferredDataTypes: ['Foundation', 'SR Legacy'],
    },
  },
  {
    ingredient: 'almonds',
    difficulty: 'easy',
    expectation: {
      descriptionContains: ['almond'],
      preferredDataTypes: ['Foundation', 'SR Legacy'],
    },
  },
  {
    ingredient: 'large egg',
    servingSize: 1,
    servingUnit: 'large',
    difficulty: 'easy',
    expectation: {
      descriptionContains: ['egg'],
      descriptionRejects: ['white', 'yolk'],
      notes: 'Whole egg, not white-only or yolk-only.',
    },
  },

  // --- medium: requires preparation-state inference ---
  {
    ingredient: 'brown rice',
    servingSize: 1,
    servingUnit: 'cup',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['rice', 'brown'],
      descriptionRejects: ['white'],
      notes: 'Should be cooked when serving is "1 cup" (raw cup is uncommon).',
    },
  },
  {
    ingredient: 'sweet potato',
    servingSize: 1,
    servingUnit: 'medium',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['sweet potato'],
      descriptionRejects: ['butternut', 'pumpkin'],
      notes: 'Should NOT match butternut squash (common Claude confusion).',
    },
  },
  {
    ingredient: 'ground turkey',
    servingSize: 4,
    servingUnit: 'oz',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['turkey', 'ground'],
      descriptionRejects: ['chicken', 'beef'],
    },
  },
  {
    ingredient: 'olive oil',
    servingSize: 1,
    servingUnit: 'tbsp',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['olive'],
      preferredDataTypes: ['Foundation', 'SR Legacy'],
    },
  },
  {
    ingredient: 'greek yogurt',
    servingSize: 1,
    servingUnit: 'cup',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['yogurt'],
      descriptionRejects: ['frozen'],
      notes: 'Plain greek yogurt expected (not flavored or frozen).',
    },
  },

  // --- hard: ambiguous, branded-leaning, or composed ---
  {
    ingredient: 'rice',
    servingSize: 1,
    servingUnit: 'cup',
    difficulty: 'hard',
    expectation: {
      descriptionContains: ['rice'],
      notes: 'Underspecified — matcher must pick a defensible default (likely white, cooked).',
    },
  },
  {
    ingredient: 'cauliflower rice',
    servingSize: 1,
    servingUnit: 'cup',
    difficulty: 'hard',
    expectation: {
      descriptionContains: ['cauliflower'],
      descriptionRejects: ['rice, white', 'rice, brown'],
      notes: 'Common Claude confusion vs white rice — macros are 8x off.',
    },
  },
  {
    ingredient: 'protein powder',
    servingSize: 1,
    servingUnit: 'scoop',
    difficulty: 'hard',
    expectation: {
      notes: 'Branded-only space; matcher SHOULD return low confidence or no_match.',
    },
  },
  {
    ingredient: 'avocado',
    servingSize: 0.5,
    servingUnit: 'medium',
    difficulty: 'hard',
    expectation: {
      descriptionContains: ['avocado'],
      notes: '"medium" portion — exercises the serving-size recommendation path.',
    },
  },
  {
    ingredient: 'salmon',
    servingSize: 6,
    servingUnit: 'oz',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['salmon'],
      descriptionRejects: ['smoked', 'canned'],
      notes: 'Cooked fillet preferred over smoked/canned.',
    },
  },
  {
    ingredient: 'oats',
    servingSize: 0.5,
    servingUnit: 'cup',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['oat'],
      notes: 'Rolled oats expected; raw vs cooked depends on whether 0.5 cup is dry or cooked.',
    },
  },
  {
    ingredient: 'spinach',
    difficulty: 'easy',
    expectation: {
      descriptionContains: ['spinach'],
    },
  },
  {
    ingredient: 'banana',
    servingSize: 1,
    servingUnit: 'medium',
    difficulty: 'easy',
    expectation: {
      descriptionContains: ['banana'],
    },
  },
  {
    ingredient: 'peanut butter',
    servingSize: 2,
    servingUnit: 'tbsp',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['peanut'],
      preferredDataTypes: ['Foundation', 'SR Legacy'],
      notes: 'Generic peanut butter preferred over branded (Jif, Skippy, etc.).',
    },
  },
  {
    ingredient: 'leftover stir-fry',
    difficulty: 'hard',
    expectation: {
      notes: 'Composed dish — matcher SHOULD return low confidence (this is a UX test, not a USDA test).',
    },
  },
  {
    ingredient: 'lentils',
    servingSize: 1,
    servingUnit: 'cup',
    difficulty: 'medium',
    expectation: {
      descriptionContains: ['lentil'],
      notes: 'Cooked lentils expected for "1 cup" serving.',
    },
  },
];

// ---------- scoring -------------------------------------------------------

interface ProbeResult {
  ingredient: string;
  difficulty: Probe['difficulty'];
  matchStatus: string;
  matchedDescription?: string;
  fdcId?: number;
  dataType?: string;
  confidence?: number;
  reasoning?: string;
  needsReview?: boolean;
  recommendedServing?: string;
  pass: boolean;
  concerns: string[];
  rawNutritionPer100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

function evaluate(probe: Probe, raw: any): ProbeResult {
  const concerns: string[] = [];
  let pass = true;

  if (raw.status === 'error') {
    return {
      ingredient: probe.ingredient,
      difficulty: probe.difficulty,
      matchStatus: 'error',
      pass: false,
      concerns: [`error: ${raw.errorMessage}`],
    };
  }

  // For probes where we expect low confidence (hard composed dishes,
  // protein powder), no_match is actually the desired outcome.
  const lowConfidenceExpected =
    probe.expectation.notes?.includes('low confidence') ||
    probe.expectation.notes?.includes('no_match');

  if (raw.status === 'no_match') {
    return {
      ingredient: probe.ingredient,
      difficulty: probe.difficulty,
      matchStatus: 'no_match',
      pass: !!lowConfidenceExpected,
      concerns: lowConfidenceExpected
        ? []
        : [`unexpected no_match: ${raw.errorMessage ?? '(no reason)'}`],
    };
  }

  const desc = raw.bestMatch?.description ?? '';
  const descLower = desc.toLowerCase();

  for (const must of probe.expectation.descriptionContains ?? []) {
    if (!descLower.includes(must.toLowerCase())) {
      concerns.push(`expected description to contain "${must}"`);
      pass = false;
    }
  }
  for (const reject of probe.expectation.descriptionRejects ?? []) {
    if (descLower.includes(reject.toLowerCase())) {
      concerns.push(`description contains rejected term "${reject}"`);
      pass = false;
    }
  }
  if (probe.expectation.preferredDataTypes?.length) {
    const dataType = raw.bestMatch?.dataType ?? '';
    if (!probe.expectation.preferredDataTypes.includes(dataType)) {
      // Soft concern only — branded match isn't necessarily wrong but is suspicious.
      concerns.push(
        `dataType "${dataType}" not in preferred [${probe.expectation.preferredDataTypes.join(', ')}]`
      );
    }
  }
  if (lowConfidenceExpected && raw.bestMatch?.confidence > 0.7) {
    concerns.push(
      `expected low confidence but got ${raw.bestMatch.confidence}`
    );
    pass = false;
  }

  return {
    ingredient: probe.ingredient,
    difficulty: probe.difficulty,
    matchStatus: raw.status,
    matchedDescription: desc,
    fdcId: raw.bestMatch?.fdcId,
    dataType: raw.bestMatch?.dataType,
    confidence: raw.bestMatch?.confidence,
    reasoning: raw.bestMatch?.reasoning,
    needsReview: raw.needsReview,
    recommendedServing:
      raw.recommendedServingSize && raw.recommendedServingUnit
        ? `${raw.recommendedServingSize} ${raw.recommendedServingUnit}`
        : undefined,
    rawNutritionPer100g: raw.bestMatch?.nutritionPer100g
      ? {
          calories: raw.bestMatch.nutritionPer100g.calories,
          protein: raw.bestMatch.nutritionPer100g.protein,
          carbs: raw.bestMatch.nutritionPer100g.carbs,
          fat: raw.bestMatch.nutritionPer100g.fat,
        }
      : undefined,
    pass,
    concerns,
  };
}

// ---------- main ---------------------------------------------------------

async function main() {
  if (!process.env.USDA_API_KEY) {
    console.error('USDA_API_KEY not set. Aborting.');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set (matcher uses Claude). Aborting.');
    process.exit(1);
  }

  console.log(`Probing USDA matcher with ${PROBES.length} ingredients...\n`);

  const results: ProbeResult[] = [];
  for (const probe of PROBES) {
    process.stdout.write(`[${probe.difficulty}] ${probe.ingredient}... `);
    try {
      const raw = await findBestUSDAMatch({
        ingredientName: probe.ingredient,
        servingSize: probe.servingSize,
        servingUnit: probe.servingUnit,
        category: probe.category,
        userId: 'snap-a-meal-eval',
      });
      const r = evaluate(probe, raw);
      results.push(r);
      console.log(r.pass ? 'PASS' : `FAIL (${r.concerns.join('; ')})`);
    } catch (err) {
      console.log(`THREW: ${(err as Error).message}`);
      results.push({
        ingredient: probe.ingredient,
        difficulty: probe.difficulty,
        matchStatus: 'threw',
        pass: false,
        concerns: [(err as Error).message],
      });
    }
    // Polite pacing — USDA limit is 1k/hr, but the matcher also calls Claude.
    await new Promise((r) => setTimeout(r, 300));
  }

  await writeFile(OUT_PATH, JSON.stringify(results, null, 2));

  // Summary
  const byDifficulty = results.reduce<Record<string, { pass: number; total: number }>>(
    (acc, r) => {
      acc[r.difficulty] ??= { pass: 0, total: 0 };
      acc[r.difficulty].total += 1;
      if (r.pass) acc[r.difficulty].pass += 1;
      return acc;
    },
    {}
  );

  console.log('\n--- summary ---');
  for (const [d, { pass, total }] of Object.entries(byDifficulty)) {
    console.log(`  ${d.padEnd(8)} ${pass}/${total}`);
  }
  const totalPass = results.filter((r) => r.pass).length;
  console.log(`  overall  ${totalPass}/${results.length}`);
  console.log(`\nfull results: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
