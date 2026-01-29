'use client'

export type MealPlanViewType = 'daily' | 'meal-type'

interface ViewToggleProps {
  view: MealPlanViewType
  onChange: (view: MealPlanViewType) => void
  'data-tour'?: string
}

const TABS: { value: MealPlanViewType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'meal-type', label: 'By Meal Type' },
]

export function ViewToggle({ view, onChange, 'data-tour': dataTour }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4" data-tour={dataTour}>
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            view === tab.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
