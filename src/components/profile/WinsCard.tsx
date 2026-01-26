'use client'

import { useEffect, useState } from 'react'
import type { UserStats } from '@/app/api/consumption/stats/route'

type TimePeriod = 'week' | 'month' | 'year' | 'all'

export default function WinsCard() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<TimePeriod>('week')

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/consumption/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-sm p-5 text-white">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🏆</span> Your Wins
        </h2>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-white/20 rounded-lg" />
          <div className="h-8 bg-white/20 rounded-lg" />
          <div className="h-8 bg-white/20 rounded-lg" />
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const getPeriodLabel = (p: TimePeriod) => {
    switch (p) {
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'year': return 'This Year'
      case 'all': return 'All Time'
    }
  }

  const getStatForPeriod = (stat: { daysHitThisWeek: number; daysHitThisMonth: number; daysHitThisYear: number }) => {
    switch (period) {
      case 'week': return stat.daysHitThisWeek
      case 'month': return stat.daysHitThisMonth
      case 'year': return stat.daysHitThisYear
      case 'all': return stat.daysHitThisYear // Use year as proxy for all-time (data only fetched for year)
    }
  }

  const getFruitVegForPeriod = () => {
    switch (period) {
      case 'week': return stats.fruitVeg.daysThisWeek
      case 'month': return stats.fruitVeg.daysThisMonth
      case 'year': return stats.fruitVeg.daysThisYear
      case 'all': return stats.fruitVeg.daysThisYear
    }
  }

  const getMealsLoggedForPeriod = () => {
    switch (period) {
      case 'week': return stats.logging.mealsLoggedThisWeek
      case 'month': return stats.logging.mealsLoggedThisMonth
      case 'year': return stats.logging.mealsLoggedThisYear
      case 'all': return stats.logging.totalMealsLogged
    }
  }

  const getDaysTrackedForPeriod = () => {
    switch (period) {
      case 'week': return stats.logging.daysLoggedThisWeek
      case 'month': return stats.logging.daysLoggedThisMonth
      case 'year': return stats.logging.daysLoggedThisYear
      case 'all': return stats.logging.totalDaysLogged
    }
  }

  const getFruitVegGramsForPeriod = () => {
    switch (period) {
      case 'week': return stats.fruitVeg.gramsThisWeek
      case 'month': return stats.fruitVeg.gramsThisMonth
      case 'year': return stats.fruitVeg.gramsThisYear
      case 'all': return stats.fruitVeg.totalGramsAllTime
    }
  }

  const getWaterOuncesForPeriod = () => {
    switch (period) {
      case 'week': return stats.water.ouncesThisWeek
      case 'month': return stats.water.ouncesThisMonth
      case 'year': return stats.water.ouncesThisYear
      case 'all': return stats.water.totalOuncesAllTime
    }
  }

  const getDaysInPeriod = (): number | null => {
    const today = new Date()
    switch (period) {
      case 'week': {
        const dayOfWeek = today.getDay()
        return dayOfWeek === 0 ? 7 : dayOfWeek // Days elapsed this week (Mon-Sun)
      }
      case 'month':
        return today.getDate()
      case 'year': {
        const start = new Date(today.getFullYear(), 0, 0)
        const diff = today.getTime() - start.getTime()
        return Math.floor(diff / (1000 * 60 * 60 * 24))
      }
      case 'all':
        return null // All-time doesn't have a denominator
    }
  }

  const daysInPeriod = getDaysInPeriod()
  const fruitVegDays = getFruitVegForPeriod()
  const calorieDays = getStatForPeriod(stats.calories)
  const proteinDays = getStatForPeriod(stats.protein)

  // Format large numbers nicely
  const formatGrams = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(1)}kg`
    }
    return `${grams}g`
  }

  // Format water ounces (convert to gallons for large amounts)
  const formatOunces = (ounces: number) => {
    if (ounces >= 128) {
      return `${(ounces / 128).toFixed(1)} gal`
    }
    return `${ounces} oz`
  }

  return (
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-5 text-white">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🏆</span> Your Wins
        </h2>
        {/* Period toggle */}
        <div className="flex bg-white/20 rounded-lg p-0.5 text-xs">
          {(['week', 'month', 'year', 'all'] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-1 rounded-md transition-all ${
                period === p
                  ? 'bg-white text-emerald-600 font-medium'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* 800g Challenge */}
        <div className="bg-white/15 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🥗</span>
            <span className="text-xs text-white/80">800g Challenge</span>
          </div>
          <div className="text-2xl font-bold">
            {fruitVegDays}
            <span className="text-sm font-normal text-white/70">
              {daysInPeriod !== null ? `/${daysInPeriod}` : ''} days
            </span>
          </div>
          {stats.fruitVeg.currentStreak > 0 && (
            <div className="text-xs text-white/80 mt-1">
              🔥 {stats.fruitVeg.currentStreak} day streak
            </div>
          )}
        </div>

        {/* Calories */}
        <div className="bg-white/15 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎯</span>
            <span className="text-xs text-white/80">Calories Hit</span>
          </div>
          <div className="text-2xl font-bold">
            {calorieDays}
            <span className="text-sm font-normal text-white/70">
              {daysInPeriod !== null ? `/${daysInPeriod}` : ''} days
            </span>
          </div>
          {stats.personalBests.longestCalorieStreak > 1 && (
            <div className="text-xs text-white/80 mt-1">
              Best: {stats.personalBests.longestCalorieStreak} day streak
            </div>
          )}
        </div>

        {/* Protein */}
        <div className="bg-white/15 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💪</span>
            <span className="text-xs text-white/80">Protein Goals</span>
          </div>
          <div className="text-2xl font-bold">
            {proteinDays}
            <span className="text-sm font-normal text-white/70">
              {daysInPeriod !== null ? `/${daysInPeriod}` : ''} days
            </span>
          </div>
          {stats.personalBests.mostProteinInADay > 0 && (
            <div className="text-xs text-white/80 mt-1">
              Best: {stats.personalBests.mostProteinInADay}g in a day
            </div>
          )}
        </div>

        {/* Logging streak */}
        <div className="bg-white/15 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📝</span>
            <span className="text-xs text-white/80">Logging Streak</span>
          </div>
          <div className="text-2xl font-bold">
            {stats.logging.currentStreak}<span className="text-sm font-normal text-white/70"> days</span>
          </div>
          {stats.logging.longestStreak > stats.logging.currentStreak && (
            <div className="text-xs text-white/80 mt-1">
              Best: {stats.logging.longestStreak} days
            </div>
          )}
        </div>
      </div>

      {/* Fun totals */}
      <div className="border-t border-white/20 pt-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold">{getMealsLoggedForPeriod()}</div>
            <div className="text-xs text-white/70">Meals</div>
          </div>
          <div>
            <div className="text-lg font-bold">{getDaysTrackedForPeriod()}</div>
            <div className="text-xs text-white/70">Days</div>
          </div>
          <div>
            <div className="text-lg font-bold">{formatGrams(getFruitVegGramsForPeriod())}</div>
            <div className="text-xs text-white/70">Produce</div>
          </div>
          <div>
            <div className="text-lg font-bold">{formatOunces(getWaterOuncesForPeriod())}</div>
            <div className="text-xs text-white/70">Water</div>
          </div>
        </div>
      </div>
    </div>
  )
}
