# Context for Claude

## Production URL

The correct production url for FuelRx's web application is: https://fuel-rx.shredstack.net

## App Development Best Practices

### Reusable Components
When adding features that appear in multiple places (e.g., onboarding AND settings), create a shared component in `src/components/` rather than duplicating code. Use the controlled component pattern where the parent manages state and passes `value`/`onChange` props.

Example: `HouseholdServingsEditor.tsx` is used by both onboarding flow and settings page.

Before writing new UI code, check if similar functionality already exists that could be extracted into a reusable component

### Important coding guidelines

1. Separation of concerns - Each module handles one thing (for example, in meal generation, each module should handle one stage of meal generation)
2. Testability - Modules should be written so that we can test individual stages/components in isolation
3. Maintainability - We want code that's easier to iterate on without risking other stages or components
4. Readability - Clear code organization for future development

### Meal Plan Generation

Meal plan generation is an important part of the app. Due to the long-running chain of llm requests, it takes roughly 5 or so minutes to complete one meal plan. We should always look for ways to optimize our llm chain requests without sacrificing quality. The meal plan generation is completely handled by Inngest with no client-side orchestration and should always stay that way.

- Client triggers the job via /api/generate-meal-plan, which creates a meal_plan_jobs record and fires an Inngest event
- The Inngest function runs through 7 steps entirely on the server
- Client just polls /api/job-status/{jobId} every 3 seconds to show progress
- Users should always be able to safely navigate away while the job builds their meal plan


## Database migrations

All database migrations live in supabase/migrations. New migrations should be generated using the following supabase command.
```bash
supabase migration new <description>
```
This will create a file in the migrations directory which can then be filled out with the SQL for the migration.

Then to apply the new migrations locally, you can use this:
```bash
supabase migration up
```

Never push migrations to production! So don't use the `--linked` flag! For example, never run the following:
```bash
supabase db push --linked
```

