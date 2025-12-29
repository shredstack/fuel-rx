'use client'

import type { PrepStyle } from '@/lib/types'
import { PREP_STYLE_LABELS } from '@/lib/types'

interface Props {
  value: PrepStyle
  onChange: (value: PrepStyle) => void
}

export default function PrepStyleSelector({ value, onChange }: Props) {
  return (
    <div className="grid gap-3">
      {(Object.keys(PREP_STYLE_LABELS) as PrepStyle[]).map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => onChange(style)}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            value === style
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="font-semibold text-gray-900">
            {PREP_STYLE_LABELS[style].title}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {PREP_STYLE_LABELS[style].description}
          </div>
        </button>
      ))}
    </div>
  )
}
