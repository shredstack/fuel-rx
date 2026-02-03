# Context for Claude

## Architecture Notes

The correct production url for FuelRx's web application is: https://fuel-rx.shredstack.net.

Native iOS app uses Capacitor WebView loading from fuel-rx.shredstack.net, so web changes automatically appear in the app without rebuild/resubmission.

### Authentication and Email Notifications

When a new user signs up, we use Resend to send the email verification to their inbox.

All email notifications for FuelRx should use Resend (and not Supabase email integration). This gives us more control on who sends it as well as flow (we can send emails for various things that the user does on the app).

For support, customers should email shredstacksarah@gmail.com.

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

### UI Performance

Fast load times are critical since the app runs in a Capacitor WebView on mobile. Follow these principles when adding or updating client-side code:

**Data fetching:**
- When a page provides server-rendered initial data, pass it to React Query via `setQueryData` and set `refetchOnMount: false` for that initial load. Don't immediately refetch data the server just sent.
- Never use manual `fetch()` + `useState` for data that should be cached across interactions (e.g., tab switches, navigation). Use React Query hooks so data is cached and served instantly on revisit.
- Use the `enabled` option to conditionally fetch — don't fetch data the user hasn't requested yet.

**Memoization:**
- Wrap derived/computed values with `useMemo` when they involve filtering, mapping, or combining arrays (e.g., building a lookup array from multiple sources).
- Wrap callback handlers passed to child components with `useCallback` so `React.memo` on those children is effective.
- Use `React.memo` on list-item components and repeated sections (e.g., `MealSection`, `MealLogCard`) to prevent re-renders when parent state changes don't affect them.

**Avoid common pitfalls:**
- Don't rebuild the same array in multiple places during render — compute it once and reuse.
- Don't pass inline arrow functions as props to memoized children (defeats `React.memo`).
- Keep large components from holding too many `useState` calls — when unrelated state changes force a full re-render, consider extracting sub-components with local state.

### Hydration Safety (SSR/Client Mismatch)

Next.js server-renders HTML before React hydrates on the client. If the server and client produce different output, React throws a hydration error. Avoid these common causes:

- **`toLocaleString()` / `toLocaleDateString()` without an explicit locale** — the server and client can resolve to different default locales. Always pass a locale, e.g., `value.toLocaleString('en-US')`.
- **`Date.now()` / `new Date()` in render** — the server timestamp differs from the client. If you need the current time, read it in a `useEffect` and store it in state.
- **`Math.random()` in render** — produces different values on each call. Use a stable seed or move to `useEffect`.
- **`typeof window !== 'undefined'` branches in render** — the server always takes the `false` branch while the client takes `true`, causing a mismatch. Use `useEffect` for client-only logic or the `suppressHydrationWarning` prop for intentional differences.
- **Browser extensions** — can modify the DOM before React hydrates. Nothing we can do about this, but be aware it exists.

### Meal Plan Generation

Meal plan generation is an important part of the app. Due to the long-running chain of llm requests, it takes roughly 5 or so minutes to complete one meal plan. We should always look for ways to optimize our llm chain requests without sacrificing quality. The meal plan generation is completely handled by Inngest with no client-side orchestration and should always stay that way.

- Client triggers the job via /api/generate-meal-plan, which creates a meal_plan_jobs record and fires an Inngest event
- The Inngest function runs through 7 steps entirely on the server
- Client just polls /api/job-status/{jobId} every 3 seconds to show progress
- Users should always be able to safely navigate away while the job builds their meal plan


### AI Features in Meal Logging

The log-meal flow uses Claude (Anthropic) for two AI-powered features. All LLM calls are logged to the `llm_logs` table. The Anthropic client is configured in `src/lib/claude/client.ts`.

#### 1. Meal Photo Analysis (Claude Vision)

**Model:** `claude-sonnet-4-20250514`

**What it does:** The "Snap a Meal" feature lets users photograph their meal. Claude Vision analyzes the photo to identify ingredients, estimate portion sizes, and calculate macros (calories, protein, carbs, fat) for each item. It also assigns confidence scores and classifies ingredients by category (protein, vegetable, fruit, grain, fat, dairy, other).

**Flow:**
1. User clicks "Snap a Meal" in `LogMealClient.tsx`
2. `MealPhotoModal.tsx` captures/uploads photo to `/api/meal-photos/upload`
3. Frontend calls `/api/meal-photos/[photoId]/analyze` (POST)
4. Backend runs Claude Vision via `analyzeMealPhoto()` in `src/lib/claude/meal-photo-analysis.ts`
5. `MealAnalysisReview.tsx` displays results for user editing
6. User confirms and logs the meal

**Key files:**
- `src/components/consumption/MealPhotoModal.tsx` - Photo capture UI
- `src/components/consumption/MealAnalysisReview.tsx` - Analysis results review
- `src/app/api/meal-photos/[photoId]/analyze/route.ts` - API route
- `src/lib/claude/meal-photo-analysis.ts` - Claude Vision call and system prompt

**Access control:** Gated behind subscription check via `checkAiAccess()` in `src/lib/subscription/check-ai-access.ts` (returns 402 if no access).

#### 2. Produce Weight Estimation (Claude Text)

**Model:** `claude-sonnet-4-5-20250929`

**What it does:** For the 800g fruit/vegetable tracking challenge, this feature detects produce items in a logged meal and estimates their weight in grams. It uses a two-tier approach: deterministic lookup first (from the `produce_weights` table), then Claude for unmatched items.

**Two entry points:**
- **From meal plan meals:** User logs a meal from today's plan -> calls `/api/consumption/extract-produce` with meal_id
- **From photo meals:** After photo analysis -> calls `/api/consumption/extract-produce-from-photo` with ingredient array

**Flow:**
1. Ingredients are checked against the `produce_weights` lookup table (no AI)
2. Already-categorized ingredients from the `ingredients` table are used when available
3. Only unmatched items are sent to Claude for classification (fruit/vegetable/other) and gram estimation
4. User sees a modal with checkboxes to select/adjust detected produce items

**Key files:**
- `src/lib/produce-extraction-service.ts` - Orchestration logic (deterministic lookup + Claude fallback)
- `src/lib/claude/produce-estimation.ts` - Claude call and system prompt
- `src/app/api/consumption/extract-produce/route.ts` - API for meal plan meals
- `src/app/api/consumption/extract-produce-from-photo/route.ts` - API for photo-analyzed meals

### Native App Compatibility (Capacitor iOS)

FuelRx runs as a native iOS app via Capacitor WebView. All features must work equally well on mobile as on web. The most common issue is **keyboard awareness** - when users tap into text inputs on mobile, the keyboard covers the input and users can't see what they're typing.

#### Required Pattern for Text Inputs

**Reference Implementation:** `src/components/CookingAssistant/ChatInput.tsx` and `src/components/CookingAssistant/CookingAssistantDrawer.tsx`

When adding any `<input>` or `<textarea>` that users will type into:

1. **Use keyboard hooks in the parent container:**
```typescript
   import { useKeyboard } from '@/hooks/useKeyboard';
   import { usePlatform } from '@/hooks/usePlatform';

   const { keyboardHeight, isKeyboardVisible } = useKeyboard();
   const { isNative } = usePlatform();
```

2. **Adjust parent layout when keyboard is visible:**
```typescript
   // In a modal or drawer, add bottom padding to prevent content from being hidden
   style={isNative && isKeyboardVisible ? { paddingBottom: keyboardHeight } : undefined}
```

3. **Scroll input into view on focus:**
```typescript
   const textareaRef = useRef<HTMLTextAreaElement>(null);

   const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
     e.stopPropagation();
     setTimeout(() => {
       textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
     }, 300);
   };
```

4. **Listen for viewport resize (web fallback):**
```typescript
   useEffect(() => {
     const viewport = window.visualViewport;
     if (!viewport) return;

     const handleResize = () => {
       if (document.activeElement === textareaRef.current) {
         setTimeout(() => {
           textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         }, 100);
       }
     };

     viewport.addEventListener('resize', handleResize);
     return () => viewport.removeEventListener('resize', handleResize);
   }, []);
```

5. **For long text content, ensure scrollability:**
```typescript
   <textarea
     className="overflow-y-auto"
     style={{ maxHeight: '128px' }}  // Or appropriate max height
   />
```

#### Existing Utilities

- `src/hooks/useKeyboard.ts` - Native keyboard height detection via Capacitor
- `src/hooks/usePlatform.ts` - Detect native vs web
- `src/components/KeyboardAwareView.tsx` - Wrapper component for simple cases

#### Key Rules

1. **Never add a text input without keyboard awareness** - If users type, they must see what they're typing
2. **Test on actual iOS device** - Simulators don't perfectly replicate keyboard behavior
3. **Modals need extra care** - Fixed/absolute positioned modals often have the worst keyboard issues
4. **Long text needs scrolling** - If text can exceed the visible area, add `overflow-y-auto` and `maxHeight`
5. **Use safe area insets** - Bottom padding should use `env(safe-area-inset-bottom)` for the home indicator

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

