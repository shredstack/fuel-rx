'use client'

import Link from 'next/link'

export default function QuickCookCard() {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">⚡</span>
        <h3 className="text-xl font-semibold text-gray-900">Quick Cook</h3>
      </div>
      <p className="text-gray-600 mb-6">
        Need just one meal? Generate a single dish or a full party prep guide in seconds.
      </p>
      <div className="flex gap-3">
        <Link
          href="/quick-cook?mode=normal"
          className="btn-primary flex-1 text-center"
        >
          Single Meal
        </Link>
        <Link
          href="/quick-cook?mode=party"
          className="btn-outline flex-1 text-center"
        >
          Party Mode 🎉
        </Link>
      </div>
    </div>
  )
}
