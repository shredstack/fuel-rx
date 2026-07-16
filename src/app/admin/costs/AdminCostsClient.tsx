'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useAdminCosts } from '@/hooks/queries/useAdminCosts'

const RANGE_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

function formatCost(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 0.1 && value > 0 ? 4 : 2,
  })
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`
  if (value >= 1_000) return `${(value / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`
  return value.toLocaleString('en-US')
}

function modelBadge(model: string) {
  const lower = model.toLowerCase()
  const color = lower.includes('sonnet')
    ? 'bg-blue-50 text-blue-700'
    : lower.includes('haiku')
      ? 'bg-green-50 text-green-700'
      : 'bg-gray-100 text-gray-700'
  const label = lower.includes('sonnet') ? 'Sonnet' : lower.includes('haiku') ? 'Haiku' : model
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
}

export default function AdminCostsClient() {
  const [days, setDays] = useState(30)
  const { data, isLoading, isError } = useAdminCosts(days)

  const maxDailyCost = Math.max(0.0001, ...(data?.daily.map((d) => d.estCost) ?? []))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-purple-600 hover:text-purple-800">
              &larr; Admin
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Cost Management</h1>
            <p className="mt-1 text-sm text-gray-600">
              Estimated AI spend from <code className="text-xs bg-gray-100 px-1 rounded">llm_logs</code>. Input
              tokens are approximated from prompt length, so treat costs as estimates (&plusmn;20%).
            </p>
          </div>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.days}
                onClick={() => setDays(option.days)}
                className={`px-3 py-1.5 text-sm ${
                  days === option.days
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="mt-10 text-center text-gray-500">Loading cost data&hellip;</div>
        )}
        {isError && (
          <div className="mt-10 text-center text-red-600">Failed to load cost data. Try refreshing.</div>
        )}

        {data && (
          <>
            {/* Summary tiles */}
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Est. total ({data.days}d)</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatCost(data.totals.estCost)}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Weekly run-rate</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatCost(data.totals.estWeeklyCost)}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">LLM calls</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.totals.calls.toLocaleString('en-US')}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Output tokens</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{formatTokens(data.totals.outputTokens)}</p>
              </div>
            </div>

            {/* Daily trend */}
            <section className="mt-8 bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900">Daily spend</h2>
              {data.daily.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No LLM calls in this window.</p>
              ) : (
                <div className="mt-3 flex items-end gap-1 h-32" role="img" aria-label="Daily estimated cost bar chart">
                  {data.daily.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div
                        className="w-full bg-purple-500 rounded-t group-hover:bg-purple-600 min-h-[2px]"
                        style={{ height: `${(d.estCost / maxDailyCost) * 100}%` }}
                      />
                      <div className="absolute -top-8 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {d.day}: {formatCost(d.estCost)} ({d.calls} calls)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Per-feature breakdown */}
            <section className="mt-8 bg-white rounded-lg border border-gray-200 overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-900 p-4 pb-0">Cost by feature</h2>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="px-4 py-2 font-medium">Feature (prompt_type)</th>
                      <th className="px-4 py-2 font-medium">Model</th>
                      <th className="px-4 py-2 font-medium text-right">Calls</th>
                      <th className="px-4 py-2 font-medium text-right">Users</th>
                      <th className="px-4 py-2 font-medium text-right">In tokens (est)</th>
                      <th className="px-4 py-2 font-medium text-right">Out tokens</th>
                      <th className="px-4 py-2 font-medium text-right">$/call (est)</th>
                      <th className="px-4 py-2 font-medium text-right">Total (est)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byFeature.map((row) => (
                      <tr key={`${row.promptType}-${row.model}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{row.promptType}</td>
                        <td className="px-4 py-2">{modelBadge(row.model)}</td>
                        <td className="px-4 py-2 text-right">{row.calls.toLocaleString('en-US')}</td>
                        <td className="px-4 py-2 text-right">{row.uniqueUsers.toLocaleString('en-US')}</td>
                        <td className="px-4 py-2 text-right">{formatTokens(row.approxInputTokens)}</td>
                        <td className="px-4 py-2 text-right">{formatTokens(row.outputTokens)}</td>
                        <td className="px-4 py-2 text-right">{formatCost(row.estCostPerCall)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCost(row.estCost)}</td>
                      </tr>
                    ))}
                    {data.byFeature.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                          No LLM calls in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top users */}
            <section className="mt-8 bg-white rounded-lg border border-gray-200 overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-900 p-4 pb-0">Highest-cost users</h2>
              <p className="px-4 mt-1 text-sm text-gray-500">
                Use this to sanity-check pricing: FuelRx Pro should be priced above what your top users cost.
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="px-4 py-2 font-medium">User</th>
                      <th className="px-4 py-2 font-medium text-right">Calls</th>
                      <th className="px-4 py-2 font-medium text-right">In tokens (est)</th>
                      <th className="px-4 py-2 font-medium text-right">Out tokens</th>
                      <th className="px-4 py-2 font-medium text-right">Cost ({data.days}d, est)</th>
                      <th className="px-4 py-2 font-medium text-right">Monthly run-rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((row) => (
                      <tr key={row.userId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{row.email || row.userId}</td>
                        <td className="px-4 py-2 text-right">{row.calls.toLocaleString('en-US')}</td>
                        <td className="px-4 py-2 text-right">{formatTokens(row.approxInputTokens)}</td>
                        <td className="px-4 py-2 text-right">{formatTokens(row.outputTokens)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCost(row.estCost)}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCost((row.estCost / data.days) * 30)}
                        </td>
                      </tr>
                    ))}
                    {data.topUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                          No LLM calls in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
