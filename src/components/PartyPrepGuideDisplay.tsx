'use client'

import { useState } from 'react'
import type { PartyPrepGuide, PartyPrepPhase, PartyDish } from '@/lib/types'

interface Props {
  guide: PartyPrepGuide
  onRegenerate: () => void
  onSave?: () => void
  saving?: boolean
}

const ROLE_COLORS: Record<PartyDish['role'], string> = {
  main: 'bg-red-100 text-red-700',
  side: 'bg-green-100 text-green-700',
  appetizer: 'bg-yellow-100 text-yellow-700',
  dessert: 'bg-pink-100 text-pink-700',
  beverage: 'bg-blue-100 text-blue-700',
}

const ROLE_LABELS: Record<PartyDish['role'], string> = {
  main: 'Main',
  side: 'Side',
  appetizer: 'Appetizer',
  dessert: 'Dessert',
  beverage: 'Beverage',
}

const PHASE_ICONS: Record<string, string> = {
  days_before: '📅',
  day_of_morning: '🌅',
  hours_before: '⏰',
  right_before: '🔔',
}

function RoleBadge({ role }: { role: PartyDish['role'] }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

function PrepPhaseCard({ phase, icon, phaseKey }: { phase: PartyPrepPhase; icon: string; phaseKey: string }) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())

  const toggleTask = (index: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h3 className="font-semibold text-gray-900 text-lg">{phase.title}</h3>
      </div>

      <div className="space-y-3">
        {phase.tasks.map((task, i) => {
          const isExpanded = expandedTasks.has(i)
          return (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleTask(i)}
                className="w-full flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="font-medium text-gray-900">{task.title}</span>
                </div>
                {task.duration && (
                  <span className="text-sm text-gray-500 flex-shrink-0">{task.duration}</span>
                )}
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50">
                  <ol className="space-y-2 mb-3">
                    {task.steps.map((step, j) => (
                      <li key={j} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-gray-400 flex-shrink-0">{j + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {task.notes && (
                    <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                      <span className="font-medium">Note:</span> {task.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PartyPrepGuideDisplay({ guide, onRegenerate, onSave, saving }: Props) {
  const [copiedList, setCopiedList] = useState(false)

  const handleCopyShoppingList = async () => {
    const text = guide.shopping_list
      .map(item => `${item.quantity} ${item.item}${item.notes ? ` (${item.notes})` : ''}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedList(true)
    setTimeout(() => setCopiedList(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 print:bg-white">
        <div className="flex items-start gap-3 mb-2">
          <span className="text-4xl">🎉</span>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{guide.name}</h2>
            <p className="text-gray-600 mt-1">{guide.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Serves: {guide.serves}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Total prep: {guide.estimated_total_prep_time}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Active time: {guide.estimated_active_time}
          </span>
        </div>
      </div>

      {/* Dishes Overview */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          What You&apos;re Making
        </h3>
        <div className="grid gap-3">
          {guide.dishes.map((dish, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <RoleBadge role={dish.role} />
              <div>
                <span className="font-medium text-gray-900">{dish.name}</span>
                <p className="text-sm text-gray-600 mt-0.5">{dish.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2 px-1">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Prep Timeline
        </h3>

        {guide.timeline.days_before && (
          <PrepPhaseCard phase={guide.timeline.days_before} icon={PHASE_ICONS.days_before} phaseKey="days_before" />
        )}
        {guide.timeline.day_of_morning && (
          <PrepPhaseCard phase={guide.timeline.day_of_morning} icon={PHASE_ICONS.day_of_morning} phaseKey="day_of_morning" />
        )}
        {guide.timeline.hours_before && (
          <PrepPhaseCard phase={guide.timeline.hours_before} icon={PHASE_ICONS.hours_before} phaseKey="hours_before" />
        )}
        {guide.timeline.right_before && (
          <PrepPhaseCard phase={guide.timeline.right_before} icon={PHASE_ICONS.right_before} phaseKey="right_before" />
        )}
      </div>

      {/* Shopping List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Shopping List
          </h3>
          <button
            onClick={handleCopyShoppingList}
            className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center gap-1 print:hidden"
          >
            {copiedList ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy List
              </>
            )}
          </button>
        </div>
        <ul className="space-y-2">
          {guide.shopping_list.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 border-2 border-gray-300 rounded flex-shrink-0 mt-0.5 print:border-gray-500" />
              <span className="flex-1">
                <span className="font-medium">{item.quantity}</span> {item.item}
                {item.notes && (
                  <span className="text-gray-500 text-sm ml-2">({item.notes})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pro Tips */}
      <div className="card bg-gradient-to-r from-amber-50 to-yellow-50 print:bg-white print:border print:border-gray-200">
        <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Pro Tips
        </h3>
        <ul className="space-y-2">
          {guide.pro_tips.map((tip, i) => (
            <li key={i} className="text-amber-900 flex gap-2">
              <span className="text-amber-600 flex-shrink-0">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-3 print:hidden">
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save to My Meals
              </>
            )}
          </button>
        )}
        <button
          onClick={handlePrint}
          className={`${onSave ? 'btn-outline' : 'btn-primary'} flex-1 flex items-center justify-center gap-2`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Guide
        </button>
        <button
          onClick={onRegenerate}
          className="btn-outline px-6"
          title="Generate another party plan"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  )
}
