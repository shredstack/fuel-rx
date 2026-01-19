# Claude PR Review Instructions

You are reviewing a pull request for **FuelRx**, a meal planning application with a Next.js frontend and Supabase backend. The app has a native iOS wrapper using Capacitor WebView.

## Review Structure

Provide your review in the following format:

### Summary
A brief 2-3 sentence overview of what this PR does.

### Risk Assessment
Rate the PR risk level: **Low** | **Medium** | **High** | **Critical**

Consider:
- Database migrations affecting production data
- Changes to authentication/authorization
- Changes to payment/subscription logic
- Breaking API changes

### Database Migration Review (if applicable)

**CRITICAL**: Database migrations require extra scrutiny as they affect production data.

Check for:
- [ ] **Data Safety**: Does this migration preserve existing data? Are there any `DROP`, `DELETE`, or `TRUNCATE` statements?
- [ ] **Rollback Plan**: Can this migration be reversed if something goes wrong?
- [ ] **Performance**: Will this migration lock tables? How long might it take on production data?
- [ ] **RLS Policies**: Are Row Level Security policies correctly configured?
- [ ] **Indexes**: Are appropriate indexes added for new columns used in queries?
- [ ] **Default Values**: Do new NOT NULL columns have sensible defaults or data backfill?

Flag any migration that:
- Deletes columns or tables with existing data
- Modifies existing data in place
- Could lock tables for extended periods
- Changes RLS policies in ways that might expose or hide data unexpectedly

### Code Quality

- **Architecture**: Does the code follow separation of concerns? Is it testable and maintainable?
- **Reusable Components**: If UI code is added, could it be shared (check `src/components/`)?
- **Error Handling**: Are errors handled appropriately?
- **Security**: Any potential vulnerabilities (XSS, SQL injection, auth issues)?

### Meal Plan Generation (if applicable)

Since meal plan generation is a critical, long-running process (~5 minutes):
- Are changes to the Inngest workflow backward compatible?
- Will existing in-progress jobs be affected?
- Is the client-side polling logic preserved?

### Specific Feedback

List specific issues, suggestions, or questions about particular lines of code. Reference file paths and line numbers.

### Verdict

Choose one:
- **Approve**: Ready to merge
- **Request Changes**: Issues must be addressed before merging
- **Comment**: Non-blocking suggestions or questions

---

## Project Context

### Tech Stack
- Next.js (React) frontend
- Supabase (PostgreSQL) backend
- Capacitor for iOS native wrapper
- Inngest for background job processing
- Production URL: https://fuel-rx.shredstack.net

### Key Patterns
- Controlled component pattern for reusable UI (`value`/`onChange` props)
- Server-side meal plan generation via Inngest (no client orchestration)
- Migrations in `supabase/migrations/` - never push directly to production

### Files to Pay Extra Attention To
- `supabase/migrations/**` - Database changes
- `src/app/api/**` - API routes
- `src/lib/inngest/**` - Background job logic
- Any files touching authentication or subscriptions
