/**
 * Snap-a-Meal evaluation: extract production photos as labeled test fixtures.
 *
 * Pulls every cooked-meal photo (meal-plan + saved-meal cooking statuses)
 * joined to the canonical recipe so each row carries:
 *   photo  +  ground-truth ingredient list  +  ground-truth macros
 *
 * Outputs:
 *   fixtures/manifest.json    — labeled corpus (one record per fixture)
 *   fixtures/photos/<id>.jpg  — downloaded photo bytes
 *
 * Run:
 *   USDA_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/snap-a-meal-eval/01-extract-test-fixtures.ts
 *
 * Defaults to reading env from .env.production.local (real corpus) — set
 * SUPABASE_ENV_FILE=.env to point at local Supabase instead.
 *
 * Flags:
 *   --quality=high|medium|low|all   default: high
 *   --limit=N                       default: 200
 *   --skip-download                 only emit manifest, don't fetch photos
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ----- env loading -------------------------------------------------------
// Tiny inline .env parser to avoid an extra dependency. Handles KEY=VALUE,
// quoted values, and comments. Inline values from process.env take priority.

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
    // missing file is fine; relevant vars may already be in process.env
  }
}

const envFile = process.env.SUPABASE_ENV_FILE ?? '.env.production.local';
await loadEnvFile(envFile);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    `Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envFile}`
  );
  process.exit(1);
}

// ----- args --------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);
const QUALITY = (args.quality as string) ?? 'high';
const LIMIT = parseInt((args.limit as string) ?? '200', 10);
const SKIP_DOWNLOAD = args['skip-download'] === 'true';

// ----- setup -------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'fixtures');
const PHOTOS_DIR = resolve(OUT_DIR, 'photos');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ----- types -------------------------------------------------------------

interface Ingredient {
  name: string;
  amount?: number | string;
  unit?: string;
  category?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface FixtureRow {
  source: 'meal_plan_cooking' | 'saved_meal_cooking';
  cooking_status_id: string;
  cooked_photo_url: string;
  cooking_status: string;
  modification_notes: string | null;
  cooked_at: string | null;
  meal_id: string;
  meal_name: string;
  gt_calories: number;
  gt_protein: number;
  gt_carbs: number;
  gt_fat: number;
  gt_ingredients: Ingredient[] | null;
  user_id: string;
  day: number | null;
  meal_type: string | null;
  ground_truth_quality: 'high' | 'medium' | 'low';
}

// ----- query -------------------------------------------------------------

async function fetchCorpus(): Promise<FixtureRow[]> {
  // Two queries (one per source table) joined client-side, since PostgREST
  // can't do UNION ALL across two base tables in a single .from() call.
  const mealPlanQ = supabase
    .from('meal_plan_meal_cooking_status')
    .select(
      `
      id,
      cooked_photo_url,
      cooking_status,
      modification_notes,
      cooked_at,
      meal_plan_meals!inner (
        day,
        meal_type,
        meal_plans!inner ( user_id ),
        meals!inner ( id, name, calories, protein, carbs, fat, ingredients )
      )
    `
    )
    .not('cooked_photo_url', 'is', null)
    .neq('cooked_photo_url', '');

  const savedQ = supabase
    .from('saved_meal_cooking_status')
    .select(
      `
      id,
      cooked_photo_url,
      cooking_status,
      modification_notes,
      cooked_at,
      user_id,
      meals!inner ( id, name, calories, protein, carbs, fat, ingredients )
    `
    )
    .not('cooked_photo_url', 'is', null)
    .neq('cooked_photo_url', '');

  const [mealPlanRes, savedRes] = await Promise.all([mealPlanQ, savedQ]);
  if (mealPlanRes.error) throw mealPlanRes.error;
  if (savedRes.error) throw savedRes.error;

  const fromMealPlan: FixtureRow[] = (mealPlanRes.data ?? []).map((row: any) => ({
    source: 'meal_plan_cooking',
    cooking_status_id: row.id,
    cooked_photo_url: row.cooked_photo_url,
    cooking_status: row.cooking_status,
    modification_notes: row.modification_notes,
    cooked_at: row.cooked_at,
    meal_id: row.meal_plan_meals.meals.id,
    meal_name: row.meal_plan_meals.meals.name,
    gt_calories: row.meal_plan_meals.meals.calories,
    gt_protein: row.meal_plan_meals.meals.protein,
    gt_carbs: row.meal_plan_meals.meals.carbs,
    gt_fat: row.meal_plan_meals.meals.fat,
    gt_ingredients: row.meal_plan_meals.meals.ingredients,
    user_id: row.meal_plan_meals.meal_plans.user_id,
    day: row.meal_plan_meals.day,
    meal_type: row.meal_plan_meals.meal_type,
    ground_truth_quality: classifyQuality(
      row.cooking_status,
      row.modification_notes
    ),
  }));

  const fromSaved: FixtureRow[] = (savedRes.data ?? []).map((row: any) => ({
    source: 'saved_meal_cooking',
    cooking_status_id: row.id,
    cooked_photo_url: row.cooked_photo_url,
    cooking_status: row.cooking_status,
    modification_notes: row.modification_notes,
    cooked_at: row.cooked_at,
    meal_id: row.meals.id,
    meal_name: row.meals.name,
    gt_calories: row.meals.calories,
    gt_protein: row.meals.protein,
    gt_carbs: row.meals.carbs,
    gt_fat: row.meals.fat,
    gt_ingredients: row.meals.ingredients,
    user_id: row.user_id,
    day: null,
    meal_type: null,
    ground_truth_quality: classifyQuality(
      row.cooking_status,
      row.modification_notes
    ),
  }));

  return [...fromMealPlan, ...fromSaved].sort((a, b) =>
    (b.cooked_at ?? '').localeCompare(a.cooked_at ?? '')
  );
}

function classifyQuality(
  status: string,
  notes: string | null
): 'high' | 'medium' | 'low' {
  const hasNotes = !!(notes && notes.trim().length > 0);
  if (status === 'cooked_as_is' && !hasNotes) return 'high';
  if (status === 'cooked_as_is') return 'medium';
  if (status === 'cooked_with_modifications' && !hasNotes) return 'medium';
  return 'low';
}

// ----- photo download ----------------------------------------------------

async function downloadPhoto(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  fetch ${res.status} for ${url}`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(destPath, buf);
    return true;
  } catch (err) {
    console.warn(`  failed to fetch ${url}:`, (err as Error).message);
    return false;
  }
}

// ----- main --------------------------------------------------------------

async function main() {
  console.log(`env file: ${envFile}`);
  console.log(`quality filter: ${QUALITY}, limit: ${LIMIT}, skip-download: ${SKIP_DOWNLOAD}`);

  const corpus = await fetchCorpus();
  console.log(`fetched ${corpus.length} candidate rows from production`);

  const filtered =
    QUALITY === 'all'
      ? corpus
      : corpus.filter((r) => {
          if (QUALITY === 'high') return r.ground_truth_quality === 'high';
          if (QUALITY === 'medium')
            return r.ground_truth_quality !== 'low';
          return true;
        });

  const selected = filtered.slice(0, LIMIT);

  // Quality breakdown for transparency
  const breakdown = selected.reduce<Record<string, number>>((acc, r) => {
    acc[r.ground_truth_quality] = (acc[r.ground_truth_quality] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`selected ${selected.length} fixtures:`, breakdown);

  await mkdir(PHOTOS_DIR, { recursive: true });

  const manifest: Array<FixtureRow & { local_photo: string | null }> = [];
  let downloaded = 0;
  for (const row of selected) {
    const fileName = `${row.cooking_status_id}.jpg`;
    const localPath = `photos/${fileName}`;
    let savedLocally: string | null = null;

    if (!SKIP_DOWNLOAD) {
      const ok = await downloadPhoto(
        row.cooked_photo_url,
        resolve(PHOTOS_DIR, fileName)
      );
      if (ok) {
        savedLocally = localPath;
        downloaded += 1;
      }
    }

    manifest.push({ ...row, local_photo: savedLocally });
  }

  const manifestPath = resolve(OUT_DIR, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nwrote ${manifest.length} entries to ${manifestPath}`);
  if (!SKIP_DOWNLOAD) {
    console.log(`downloaded ${downloaded}/${selected.length} photos to ${PHOTOS_DIR}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
