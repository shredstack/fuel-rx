/**
 * Supabase has a server-side `max_rows` limit (default 1000) that cannot be exceeded
 * by client-side `.limit()` calls. This utility fetches all matching rows by paginating
 * through the results in batches.
 *
 * Use this for any query that could exceed 1000 rows over time, such as:
 * - Consumption logs (users log ~15 items/day, exceeds 1000 in ~67 days)
 * - Historical data across long date ranges (e.g., 52 weeks of data)
 * - Any user-generated content that accumulates
 *
 * @example
 * ```typescript
 * const entries = await paginateQuery<ConsumptionEntry>(
 *   async (offset, pageSize) => {
 *     const { data, error } = await supabase
 *       .from('meal_consumption_log')
 *       .select('consumed_date, calories')
 *       .eq('user_id', userId)
 *       .gte('consumed_date', startDate)
 *       .lte('consumed_date', endDate)
 *       .order('consumed_date', { ascending: true })
 *       .range(offset, offset + pageSize - 1);
 *
 *     if (error) throw new Error(error.message);
 *     return data || [];
 *   }
 * );
 * ```
 */
export async function paginateQuery<T>(
  fetchBatch: (offset: number, pageSize: number) => Promise<T[]>,
  pageSize: number = 1000
): Promise<T[]> {
  let results: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await fetchBatch(offset, pageSize);

    if (batch.length > 0) {
      results = results.concat(batch);
      offset += batch.length;
      hasMore = batch.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return results;
}
