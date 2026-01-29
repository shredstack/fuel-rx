import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateMealPlanFunction } from '@/lib/inngest/functions/generate-meal-plan';
import { generateBatchPrepFunction } from '@/lib/inngest/functions/generate-batch-prep';
import { usdaBackfillFunction } from '@/lib/inngest/functions/usda-backfill-ingredients';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateMealPlanFunction, generateBatchPrepFunction, usdaBackfillFunction],
});
