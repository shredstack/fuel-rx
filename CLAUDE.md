# Context for Claude

## Architecture Notes

The correct production url for FuelRx's web application is: https://fuel-rx.shredstack.net.

Native iOS app uses Capacitor WebView loading from fuel-rx.shredstack.net, so web changes automatically appear in the app without rebuild/resubmission.

### Authentication and Email Notifications

When a new user signs up, we use Resend to send the email verification to their inbox.

All email notifications for FuelRx should use Resend (and not Supabase email integration). This gives us more control on who sends it as well as flow (we can send emails for various things that the user does on the app).

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

### React Query for Data Fetching

We use TanStack Query (React Query) for all client-side data fetching to ensure the UI stays up-to-date after user actions. **Never use manual `fetch` + `useState` patterns** for data that needs to stay synchronized.

**Key files:**
- `src/providers/QueryProvider.tsx` - App-wide provider with default config
- `src/lib/queryKeys.ts` - Query key factory for cache invalidation
- `src/hooks/queries/` - All query and mutation hooks

**Creating query hooks:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export function useMyData(id: string) {
  return useQuery({
    queryKey: queryKeys.myDomain.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/my-data/${id}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });
}
```

**Creating mutation hooks with cache invalidation:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export function useUpdateMyData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/my-data', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries so UI updates
      queryClient.invalidateQueries({ queryKey: queryKeys.myDomain.all });
    },
  });
}
```

**Guidelines:**
- Always add new query keys to `queryKeys.ts` using the hierarchical pattern
- Mutations should invalidate related queries in `onSuccess` to keep UI in sync
- Use optimistic updates for instant feedback on user actions (see `useSocialFeed.ts` for examples)
- For polling, use `refetchInterval` that stops when done (see `useJobStatus.ts`)

### Supabase Realtime for Cross-Device Sync

We use Supabase Realtime to keep data synchronized across devices. When a user makes a change on one device, other devices automatically see the update without requiring a manual refresh.

**Key files:**
- `src/providers/RealtimeProvider.tsx` - Sets up all Realtime subscriptions at the app level
- `src/hooks/useRealtimeSubscription.ts` - Reusable hook for component-level subscriptions

**Currently subscribed tables:**
- `meal_consumption_log` - Consumption tracking
- `meal_plans` - Meal plan data
- `meal_plan_meals` - Individual meals within plans
- `social_feed_posts` - Community posts
- `user_grocery_staples` - Grocery staples
- `ingredients` - Admin ingredient updates (nutrition info, etc.)

**When to add Realtime subscriptions:**

Add a new Realtime subscription when:
1. Data can be modified from multiple devices (e.g., logging meals from phone and desktop)
2. Data can be modified by server processes (e.g., meal plan generation via Inngest)
3. Data is shared between users (e.g., social feed posts)

**How to add a new Realtime subscription:**

1. **Enable Realtime on the table** - Create a migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE your_table_name;
```

2. **Add subscription to RealtimeProvider** - In `src/providers/RealtimeProvider.tsx`:
```typescript
.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'your_table_name',
    filter: `user_id=eq.${user.id}`, // Filter to user's data when applicable
  },
  () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.yourDomain.all,
    });
  }
)
```

3. **For component-specific subscriptions**, use the `useRealtimeSubscription` hook:
```typescript
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

useRealtimeSubscription({
  table: 'your_table_name',
  filter: `user_id=eq.${userId}`,
  queryKeys: queryKeys.yourDomain.all,
});
```

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

