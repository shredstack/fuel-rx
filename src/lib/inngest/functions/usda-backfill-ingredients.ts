/**
 * USDA Backfill Inngest Function
 *
 * Processes ingredients in batches to match them to USDA FoodData Central entries.
 * Uses Claude to intelligently select the best match for each ingredient.
 *
 * Features:
 * - Batch processing with rate limiting
 * - Progress tracking via job record
 * - Respects soft deletes
 * - Logs all changes to admin audit log
 */

import { inngest } from '../client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { findBestUSDAMatch } from '@/lib/usda-matching-service';
import { getUSDAFoodDetails, extractNutritionPer100g, getCommonPortions } from '@/lib/usda-service';

// ============================================
// Supabase Service Role Client
// ============================================

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or service role key');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================
// Helper: Convert per-100g nutrition to serving
// Uses USDA portion data for non-weight units
// ============================================

const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  kg: 1000,
};

// Common unit aliases for matching USDA portions
const UNIT_ALIASES: Record<string, string[]> = {
  cup: ['cup', 'cups', 'c'],
  tbsp: ['tbsp', 'tablespoon', 'tablespoons', 'tbs', 'T'],
  tsp: ['tsp', 'teaspoon', 'teaspoons', 't'],
  whole: ['whole', 'unit', 'piece', 'item', 'each'],
  slice: ['slice', 'slices'],
  medium: ['medium', 'med'],
  large: ['large', 'lg'],
  small: ['small', 'sm'],
};

function findMatchingPortion(
  portions: Array<{ description: string; gramWeight: number; amount: number; unit: string }>,
  servingSize: number,
  servingUnit: string
): number | null {
  const unitLower = servingUnit.toLowerCase();

  let canonicalUnit: string | null = null;
  for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
    if (aliases.includes(unitLower) || unitLower.includes(canonical)) {
      canonicalUnit = canonical;
      break;
    }
  }

  for (const portion of portions) {
    const portionDesc = portion.description.toLowerCase();
    const portionUnit = portion.unit.toLowerCase();

    if (portionUnit === unitLower || portionDesc.includes(unitLower)) {
      return (portion.gramWeight / portion.amount) * servingSize;
    }

    if (canonicalUnit && (portionUnit.includes(canonicalUnit) || portionDesc.includes(canonicalUnit))) {
      return (portion.gramWeight / portion.amount) * servingSize;
    }
  }

  return null;
}

function calculateServingNutritionWithPortions(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number | null; sugar: number | null },
  servingSize: number,
  servingUnit: string,
  usdaPortions: Array<{ description: string; gramWeight: number; amount: number; unit: string }>
) {
  const unit = servingUnit.toLowerCase();

  // Method 1: Direct weight conversion
  const gramsPerUnit = GRAMS_PER_UNIT[unit];
  if (gramsPerUnit) {
    const servingGrams = servingSize * gramsPerUnit;
    const multiplier = servingGrams / 100;
    return {
      calories: Math.round(per100g.calories * multiplier),
      protein: Math.round(per100g.protein * multiplier * 10) / 10,
      carbs: Math.round(per100g.carbs * multiplier * 10) / 10,
      fat: Math.round(per100g.fat * multiplier * 10) / 10,
      fiber: per100g.fiber !== null ? Math.round(per100g.fiber * multiplier * 10) / 10 : null,
      sugar: per100g.sugar !== null ? Math.round(per100g.sugar * multiplier * 10) / 10 : null,
    };
  }

  // Method 2: Try to find matching USDA portion
  const portionGrams = findMatchingPortion(usdaPortions, servingSize, servingUnit);
  if (portionGrams) {
    const multiplier = portionGrams / 100;
    return {
      calories: Math.round(per100g.calories * multiplier),
      protein: Math.round(per100g.protein * multiplier * 10) / 10,
      carbs: Math.round(per100g.carbs * multiplier * 10) / 10,
      fat: Math.round(per100g.fat * multiplier * 10) / 10,
      fiber: per100g.fiber !== null ? Math.round(per100g.fiber * multiplier * 10) / 10 : null,
      sugar: per100g.sugar !== null ? Math.round(per100g.sugar * multiplier * 10) / 10 : null,
    };
  }

  // Method 3: No conversion possible
  return null;
}

// ============================================
// Inngest Function
// ============================================

export const usdaBackfillFunction = inngest.createFunction(
  {
    id: 'usda-backfill-ingredients',
    retries: 1,
    concurrency: { limit: 1 }, // Only one backfill job at a time
  },
  { event: 'admin/usda-backfill' },
  async ({ event, step }) => {
    const {
      jobId,
      adminUserId,
      source = 'llm_estimated',
      batchSize = 50,
      limit,
      nutritionIds,
      includeAlreadyMatched = false,
    } = event.data as {
      jobId: string;
      adminUserId: string;
      source?: string;
      batchSize?: number;
      limit?: number;
      nutritionIds?: string[];
      includeAlreadyMatched?: boolean;
    };

    const supabase = createServiceRoleClient();

    // Track progress
    let totalProcessed = 0;
    let totalMatched = 0;
    let totalNoMatch = 0;
    let totalErrors = 0;

    // Update job status helper
    async function updateJobStatus(status: string, additionalData?: Record<string, unknown>) {
      try {
        await supabase
          .from('usda_backfill_jobs')
          .update({
            status,
            processed_count: totalProcessed,
            matched_count: totalMatched,
            no_match_count: totalNoMatch,
            error_count: totalErrors,
            updated_at: new Date().toISOString(),
            ...additionalData,
          })
          .eq('id', jobId);
      } catch (e) {
        // Job tracking table might not exist
        console.log('Could not update job status (table may not exist):', e);
      }
    }

    try {
      // Mark job as running
      await updateJobStatus('running', { started_at: new Date().toISOString() });

      // Step 1: Get total count of ingredients to process
      const stats = await step.run('get-ingredients-count', async () => {
        // If specific IDs provided, use those
        if (nutritionIds && nutritionIds.length > 0) {
          return { total: nutritionIds.length };
        }

        // Otherwise query based on filters
        let query = supabase
          .from('ingredient_nutrition_with_details')
          .select('id', { count: 'exact', head: true });

        // Filter by match status unless re-matching
        if (!includeAlreadyMatched) {
          query = query.eq('usda_match_status', 'pending');
        }

        // Filter by source
        if (source === 'llm_estimated') {
          query = query.eq('source', 'llm_estimated');
        } else if (source === 'usda') {
          query = query.eq('source', 'usda');
        }
        // 'all' means no source filter

        const { count, error } = await query;

        if (error) {
          throw new Error(`Failed to count ingredients: ${error.message}`);
        }

        return {
          total: limit ? Math.min(count || 0, limit) : (count || 0),
        };
      });

      console.log(`[USDA Backfill] Starting backfill for ${stats.total} ingredients`);

      if (stats.total === 0) {
        await updateJobStatus('completed', { completed_at: new Date().toISOString() });
        return { total: 0, matched: 0, noMatch: 0, errors: 0 };
      }

      // Process in batches
      let offset = 0;
      const maxToProcess = limit || stats.total;

      while (totalProcessed < maxToProcess) {
        const batchNumber = Math.floor(offset / batchSize) + 1;

        // Step for each batch
        const batchResult = await step.run(`process-batch-${batchNumber}`, async () => {
          let ingredients;
          let error;

          if (nutritionIds && nutritionIds.length > 0) {
            // Process specific IDs
            const batchIds = nutritionIds.slice(offset, offset + batchSize);
            const result = await supabase
              .from('ingredient_nutrition_with_details')
              .select('*')
              .in('id', batchIds);
            ingredients = result.data;
            error = result.error;
          } else {
            // Query based on filters
            let query = supabase
              .from('ingredient_nutrition_with_details')
              .select('*')
              .order('created_at', { ascending: true })
              .range(offset, offset + batchSize - 1);

            // Filter by match status unless re-matching
            if (!includeAlreadyMatched) {
              query = query.eq('usda_match_status', 'pending');
            }

            // Filter by source
            if (source === 'llm_estimated') {
              query = query.eq('source', 'llm_estimated');
            } else if (source === 'usda') {
              query = query.eq('source', 'usda');
            }
            // 'all' means no source filter

            const result = await query;
            ingredients = result.data;
            error = result.error;
          }

          if (error) {
            throw new Error(`Failed to fetch batch: ${error.message}`);
          }

          if (!ingredients || ingredients.length === 0) {
            return { processed: 0, matched: 0, noMatch: 0, errors: 0 };
          }

          let batchMatched = 0;
          let batchNoMatch = 0;
          let batchErrors = 0;
          let batchProcessed = 0;

          // Helper to update progress during batch processing
          const updateBatchProgress = async () => {
            try {
              await supabase
                .from('usda_backfill_jobs')
                .update({
                  processed_count: totalProcessed + batchProcessed,
                  matched_count: totalMatched + batchMatched,
                  no_match_count: totalNoMatch + batchNoMatch,
                  error_count: totalErrors + batchErrors,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobId);
            } catch {
              // Ignore progress update errors
            }
          };

          // Process each ingredient in the batch
          for (const nutrition of ingredients) {
            try {
              // Run Claude matching
              const matchResult = await findBestUSDAMatch({
                ingredientName: nutrition.ingredient_name,
                servingSize: nutrition.serving_size,
                servingUnit: nutrition.serving_unit,
                category: nutrition.category,
                existingNutrition: {
                  calories: nutrition.calories,
                  protein: nutrition.protein,
                  carbs: nutrition.carbs,
                  fat: nutrition.fat,
                },
                userId: adminUserId,
              });

              // Build update based on result
              const updateData: Record<string, unknown> = {
                usda_matched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                usda_match_job_id: jobId,  // Track which job made this change
              };

              // Prepare history record with previous values
              const historyRecord: Record<string, unknown> = {
                nutrition_id: nutrition.id,
                job_id: jobId,
                ingredient_name: nutrition.ingredient_name,
                serving_size: nutrition.serving_size,
                serving_unit: nutrition.serving_unit,
                // Previous values
                previous_calories: nutrition.calories,
                previous_protein: nutrition.protein,
                previous_carbs: nutrition.carbs,
                previous_fat: nutrition.fat,
                previous_fiber: nutrition.fiber,
                previous_sugar: nutrition.sugar,
                previous_source: nutrition.source,
                previous_confidence_score: nutrition.confidence_score,
                previous_usda_fdc_id: nutrition.usda_fdc_id,
                previous_usda_match_status: nutrition.usda_match_status,
                previous_usda_match_confidence: nutrition.usda_match_confidence,
                previous_usda_calories_per_100g: nutrition.usda_calories_per_100g,
                previous_usda_protein_per_100g: nutrition.usda_protein_per_100g,
                previous_usda_carbs_per_100g: nutrition.usda_carbs_per_100g,
                previous_usda_fat_per_100g: nutrition.usda_fat_per_100g,
                previous_usda_fiber_per_100g: nutrition.usda_fiber_per_100g,
                previous_usda_sugar_per_100g: nutrition.usda_sugar_per_100g,
              };

              if (matchResult.status === 'matched' && matchResult.bestMatch) {
                // Fetch full USDA details for the match
                const usdaFood = await getUSDAFoodDetails(matchResult.bestMatch.fdcId);
                const nutritionPer100g = usdaFood
                  ? extractNutritionPer100g(usdaFood)
                  : matchResult.bestMatch.nutritionPer100g;

                updateData.usda_fdc_id = matchResult.bestMatch.fdcId.toString();
                updateData.usda_match_status = matchResult.needsReview ? 'needs_review' : 'matched';
                updateData.usda_match_confidence = matchResult.bestMatch.confidence;
                updateData.usda_match_reasoning = matchResult.bestMatch.reasoning;
                updateData.usda_calories_per_100g = nutritionPer100g.calories;
                updateData.usda_protein_per_100g = nutritionPer100g.protein;
                updateData.usda_carbs_per_100g = nutritionPer100g.carbs;
                updateData.usda_fat_per_100g = nutritionPer100g.fat;
                updateData.usda_fiber_per_100g = nutritionPer100g.fiber;
                updateData.usda_sugar_per_100g = nutritionPer100g.sugar;
                updateData.source = 'usda';
                updateData.confidence_score = 0.95;

                // Get USDA portions for unit conversion
                const usdaPortions = usdaFood ? getCommonPortions(usdaFood) : [];

                // Check if Claude recommended changing the serving size/unit
                let effectiveServingSize = nutrition.serving_size;
                let effectiveServingUnit = nutrition.serving_unit;
                let servingChangeApplied = false;

                if (matchResult.recommendedServingSize && matchResult.recommendedServingUnit) {
                  // Check if the new serving combo would conflict with an existing record
                  const { data: existingRecord } = await supabase
                    .from('ingredient_nutrition')
                    .select('id')
                    .eq('ingredient_id', nutrition.ingredient_id)
                    .eq('serving_size', matchResult.recommendedServingSize)
                    .eq('serving_unit', matchResult.recommendedServingUnit)
                    .neq('id', nutrition.id)
                    .maybeSingle();

                  if (!existingRecord) {
                    // No conflict - apply the serving change
                    effectiveServingSize = matchResult.recommendedServingSize;
                    effectiveServingUnit = matchResult.recommendedServingUnit;
                    updateData.serving_size = effectiveServingSize;
                    updateData.serving_unit = effectiveServingUnit;
                    servingChangeApplied = true;

                    // Add serving change reason to the match reasoning
                    if (matchResult.servingChangeReason) {
                      updateData.usda_match_reasoning =
                        `${matchResult.bestMatch.reasoning}. Serving adjusted: ${matchResult.servingChangeReason}`;
                    }
                  } else {
                    // Conflict detected - skip serving change, flag for review so admin can delete the weird one
                    console.log(`Skipping serving change for ${nutrition.ingredient_name}: ${matchResult.recommendedServingSize} ${matchResult.recommendedServingUnit} already exists`);
                    updateData.usda_match_status = 'needs_review';
                    updateData.usda_match_reasoning =
                      `${matchResult.bestMatch.reasoning}. NEEDS REVIEW: Recommended serving change to ${matchResult.recommendedServingSize} ${matchResult.recommendedServingUnit} skipped because that record already exists. Consider deleting this duplicate entry with non-standard serving unit "${nutrition.serving_unit}".`;
                  }
                }

                // Calculate serving-specific nutrition using the effective serving size/unit
                const servingNutrition = calculateServingNutritionWithPortions(
                  nutritionPer100g,
                  effectiveServingSize,
                  effectiveServingUnit,
                  usdaPortions
                );

                if (servingNutrition) {
                  updateData.calories = servingNutrition.calories;
                  updateData.protein = servingNutrition.protein;
                  updateData.carbs = servingNutrition.carbs;
                  updateData.fat = servingNutrition.fat;
                  if (servingNutrition.fiber !== null) {
                    updateData.fiber = servingNutrition.fiber;
                  }
                  if (servingNutrition.sugar !== null) {
                    updateData.sugar = servingNutrition.sugar;
                  }
                }

                // Additional validation: flag for review if calorie difference is large
                if (nutrition.calories && servingNutrition) {
                  const calorieDiff = Math.abs(servingNutrition.calories - nutrition.calories) / nutrition.calories;
                  if (calorieDiff > 0.4 && !matchResult.needsReview) {
                    updateData.usda_match_status = 'needs_review';
                    updateData.usda_match_reasoning =
                      `${updateData.usda_match_reasoning || matchResult.bestMatch.reasoning}. ` +
                      `NOTE: Calorie difference of ${Math.round(calorieDiff * 100)}% from previous estimate - please verify.`;
                  }
                }

                batchMatched++;
              } else {
                // No match or error
                updateData.usda_match_status = 'no_match';
                updateData.usda_match_reasoning = matchResult.errorMessage || 'No suitable USDA match found';
                batchNoMatch++;
              }

              // Add new values to history record
              historyRecord.new_calories = updateData.calories ?? nutrition.calories;
              historyRecord.new_protein = updateData.protein ?? nutrition.protein;
              historyRecord.new_carbs = updateData.carbs ?? nutrition.carbs;
              historyRecord.new_fat = updateData.fat ?? nutrition.fat;
              historyRecord.new_fiber = updateData.fiber ?? nutrition.fiber;
              historyRecord.new_sugar = updateData.sugar ?? nutrition.sugar;
              historyRecord.new_source = updateData.source ?? nutrition.source;
              historyRecord.new_confidence_score = updateData.confidence_score ?? nutrition.confidence_score;
              historyRecord.new_usda_fdc_id = updateData.usda_fdc_id ?? nutrition.usda_fdc_id;
              historyRecord.new_usda_match_status = updateData.usda_match_status ?? nutrition.usda_match_status;
              historyRecord.new_usda_match_confidence = updateData.usda_match_confidence ?? nutrition.usda_match_confidence;
              historyRecord.new_usda_calories_per_100g = updateData.usda_calories_per_100g ?? nutrition.usda_calories_per_100g;
              historyRecord.new_usda_protein_per_100g = updateData.usda_protein_per_100g ?? nutrition.usda_protein_per_100g;
              historyRecord.new_usda_carbs_per_100g = updateData.usda_carbs_per_100g ?? nutrition.usda_carbs_per_100g;
              historyRecord.new_usda_fat_per_100g = updateData.usda_fat_per_100g ?? nutrition.usda_fat_per_100g;
              historyRecord.new_usda_fiber_per_100g = updateData.usda_fiber_per_100g ?? nutrition.usda_fiber_per_100g;
              historyRecord.new_usda_sugar_per_100g = updateData.usda_sugar_per_100g ?? nutrition.usda_sugar_per_100g;

              // Save history record first (so we can rollback if needed)
              const { error: historyError } = await supabase
                .from('ingredient_nutrition_history')
                .insert(historyRecord);

              if (historyError) {
                console.error(`Failed to save history for nutrition ${nutrition.id}:`, historyError);
                // Continue anyway - history is nice to have but not critical
              }

              // Update the nutrition record
              const { error: updateError } = await supabase
                .from('ingredient_nutrition')
                .update(updateData)
                .eq('id', nutrition.id);

              if (updateError) {
                console.error(`Failed to update nutrition ${nutrition.id}:`, updateError);
                batchErrors++;
              }

              // Increment processed count and update progress
              batchProcessed++;
              await updateBatchProgress();

              // Small delay between individual items to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`Error processing ingredient ${nutrition.ingredient_name}:`, error);
              batchErrors++;

              // Mark as error so we don't retry this one
              await supabase
                .from('ingredient_nutrition')
                .update({
                  usda_match_status: 'no_match',
                  usda_match_reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', nutrition.id);

              // Increment processed count and update progress even for errors
              batchProcessed++;
              await updateBatchProgress();
            }
          }

          return {
            processed: ingredients.length,
            matched: batchMatched,
            noMatch: batchNoMatch,
            errors: batchErrors,
          };
        });

        totalProcessed += batchResult.processed;
        totalMatched += batchResult.matched;
        totalNoMatch += batchResult.noMatch;
        totalErrors += batchResult.errors;
        offset += batchSize;

        // Update job progress
        await updateJobStatus('running');

        console.log(`[USDA Backfill] Batch ${batchNumber} complete: ${batchResult.processed} processed, ${batchResult.matched} matched`);

        // Rate limiting: pause between batches
        if (totalProcessed < maxToProcess && batchResult.processed > 0) {
          await step.sleep('rate-limit-pause', '3s');
        }

        // Exit if batch was empty (no more to process)
        if (batchResult.processed === 0) {
          break;
        }
      }

      // Mark job as completed
      await updateJobStatus('completed', { completed_at: new Date().toISOString() });

      console.log(`[USDA Backfill] Completed: ${totalProcessed} processed, ${totalMatched} matched, ${totalNoMatch} no match, ${totalErrors} errors`);

      return {
        total: totalProcessed,
        matched: totalMatched,
        noMatch: totalNoMatch,
        errors: totalErrors,
      };
    } catch (error) {
      console.error('[USDA Backfill] Job failed:', error);

      await updateJobStatus('failed', {
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }
);
