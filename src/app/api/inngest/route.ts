import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateMealPlanFunction } from '@/lib/inngest/functions/generate-meal-plan';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateMealPlanFunction],
});
