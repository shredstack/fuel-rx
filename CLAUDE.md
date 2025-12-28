# Context for Claude

## App Development Best Practices

### Reusable Components
When adding features that appear in multiple places (e.g., onboarding AND settings), create a shared component in `src/components/` rather than duplicating code. Use the controlled component pattern where the parent manages state and passes `value`/`onChange` props.

Example: `HouseholdServingsEditor.tsx` is used by both onboarding flow and settings page.

Before writing new UI code, check if similar functionality already exists that could be extracted into a reusable component



## Database migrations

All database migrations live in supabase/migrations. New migrations should be generated using the following supabase command.
```bash
supabase migration new <description>
```
This will create a file in the migrations directory which can then be filled out with the SQL for the migration.

Then to run the new migrations locally, you can use this:
```bash
supabase migration up
```



