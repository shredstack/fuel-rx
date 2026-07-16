/**
 * Admin LLM Cost Dashboard API
 *
 * Aggregates llm_logs into per-feature, per-day, and per-user cost estimates.
 * Aggregation runs in Postgres (see migration 20260716123159) so we never pull
 * raw log rows. Input tokens are approximated as length(prompt) / 4 because
 * only output tokens were recorded historically — treat costs as estimates.
 */

import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin-service'

// Pricing per million tokens (USD). Matched by substring so dated model IDs
// (e.g. claude-haiku-4-5-20251001) resolve to their family.
const MODEL_PRICING: { match: string; inputPerMTok: number; outputPerMTok: number }[] = [
  { match: 'opus', inputPerMTok: 5, outputPerMTok: 25 },
  { match: 'sonnet', inputPerMTok: 3, outputPerMTok: 15 },
  { match: 'haiku', inputPerMTok: 1, outputPerMTok: 5 },
]

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing =
    MODEL_PRICING.find((p) => model.toLowerCase().includes(p.match)) ??
    // Unknown models (e.g. test-mode stubs) priced at Sonnet rates as a safe upper bound
    MODEL_PRICING[1]
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok
  )
}

interface SummaryRow {
  prompt_type: string
  model: string
  calls: number
  unique_users: number
  output_tokens: number
  approx_input_tokens: number
  avg_duration_ms: number | null
}

interface DailyRow {
  day: string
  model: string
  calls: number
  output_tokens: number
  approx_input_tokens: number
}

interface TopUserRow {
  user_id: string
  email: string | null
  calls: number
  output_tokens: number
  approx_input_tokens: number
  sonnet_output_tokens: number
  sonnet_approx_input_tokens: number
  haiku_output_tokens: number
  haiku_approx_input_tokens: number
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminStatus = await isAdmin(supabase, user.id)
  if (!adminStatus) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const daysParam = Number.parseInt(searchParams.get('days') || '30', 10)
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // llm_logs RLS only exposes a user's own rows — cross-user aggregation
  // requires the service role client (route is admin-gated above).
  const serviceClient = createServiceRoleClient()

  const [summaryRes, dailyRes, topUsersRes] = await Promise.all([
    serviceClient.rpc('admin_llm_usage_summary', { start_date: startDate }),
    serviceClient.rpc('admin_llm_daily_usage', { start_date: startDate }),
    serviceClient.rpc('admin_llm_top_users', { start_date: startDate, user_limit: 20 }),
  ])

  const rpcError = summaryRes.error || dailyRes.error || topUsersRes.error
  if (rpcError) {
    console.error('Failed to fetch LLM cost stats:', rpcError)
    return NextResponse.json({ error: 'Failed to fetch cost stats' }, { status: 500 })
  }

  const summaryRows = (summaryRes.data || []) as SummaryRow[]
  const dailyRows = (dailyRes.data || []) as DailyRow[]
  const topUserRows = (topUsersRes.data || []) as TopUserRow[]

  const byFeature = summaryRows.map((row) => {
    const estCost = estimateCost(row.model, row.approx_input_tokens, row.output_tokens)
    return {
      promptType: row.prompt_type,
      model: row.model,
      calls: Number(row.calls),
      uniqueUsers: Number(row.unique_users),
      outputTokens: Number(row.output_tokens),
      approxInputTokens: Number(row.approx_input_tokens),
      avgDurationMs: row.avg_duration_ms === null ? null : Number(row.avg_duration_ms),
      estCost,
      estCostPerCall: Number(row.calls) > 0 ? estCost / Number(row.calls) : 0,
    }
  })

  // Merge per-model rows into a per-day total
  const dailyMap = new Map<string, { day: string; calls: number; estCost: number }>()
  for (const row of dailyRows) {
    const entry = dailyMap.get(row.day) || { day: row.day, calls: 0, estCost: 0 }
    entry.calls += Number(row.calls)
    entry.estCost += estimateCost(row.model, Number(row.approx_input_tokens), Number(row.output_tokens))
    dailyMap.set(row.day, entry)
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day))

  const topUsers = topUserRows
    .map((row) => {
      const estCost =
        estimateCost('sonnet', Number(row.sonnet_approx_input_tokens), Number(row.sonnet_output_tokens)) +
        estimateCost('haiku', Number(row.haiku_approx_input_tokens), Number(row.haiku_output_tokens))
      return {
        userId: row.user_id,
        email: row.email,
        calls: Number(row.calls),
        outputTokens: Number(row.output_tokens),
        approxInputTokens: Number(row.approx_input_tokens),
        estCost,
      }
    })
    .sort((a, b) => b.estCost - a.estCost)

  const totals = byFeature.reduce(
    (acc, row) => {
      acc.calls += row.calls
      acc.outputTokens += row.outputTokens
      acc.approxInputTokens += row.approxInputTokens
      acc.estCost += row.estCost
      return acc
    },
    { calls: 0, outputTokens: 0, approxInputTokens: 0, estCost: 0 }
  )

  const totalUniqueUsers = new Set(topUserRows.map((r) => r.user_id)).size

  return NextResponse.json({
    days,
    totals: {
      ...totals,
      // Weekly run-rate normalized from the selected window
      estWeeklyCost: (totals.estCost / days) * 7,
      topUserCount: totalUniqueUsers,
    },
    byFeature,
    daily,
    topUsers,
  })
}
