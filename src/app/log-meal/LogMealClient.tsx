'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { createClient } from '@/lib/supabase/client';
import type {
  DailyConsumptionSummary,
  AvailableMealsToLog,
  MealToLog,
  MealPlanMealToLog,
  IngredientToLog,
  ConsumptionEntry,
  Macros,
  ConsumptionPeriodType,
  PeriodConsumptionSummary,
  MealType,
} from '@/lib/types';
import DailyProgressCard from '@/components/consumption/DailyProgressCard';
import MealSourceSection from '@/components/consumption/MealSourceSection';
import IngredientSearchBar from '@/components/consumption/IngredientSearchBar';
import IngredientAmountPicker from '@/components/consumption/IngredientAmountPicker';
import AddIngredientModal from '@/components/consumption/AddIngredientModal';
import MealPhotoModal from '@/components/consumption/MealPhotoModal';
import MealPlanMealsSection from '@/components/consumption/MealPlanMealsSection';
import PeriodTabs from '@/components/consumption/PeriodTabs';
import PeriodProgressCard from '@/components/consumption/PeriodProgressCard';
import TrendChart from '@/components/consumption/TrendChart';

interface Props {
  initialDate: string;
  initialSummary: DailyConsumptionSummary;
  initialAvailable: AvailableMealsToLog;
}

// Time-based meal type suggestions
function getTimeBasedMealTypes(): MealType[] {
  const hour = new Date().getHours();
  if (hour < 10) return ['breakfast'];
  if (hour < 14) return ['lunch', 'snack'];
  if (hour < 18) return ['snack'];
  return ['dinner', 'snack'];
}

export default function LogMealClient({ initialDate, initialSummary, initialAvailable }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [summary, setSummary] = useState(initialSummary);
  const [available, setAvailable] = useState(initialAvailable);
  const [loading, setLoading] = useState(false);

  // Period view state
  const [selectedPeriod, setSelectedPeriod] = useState<ConsumptionPeriodType>('daily');
  const [periodSummary, setPeriodSummary] = useState<PeriodConsumptionSummary | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  // Modal states
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientToLog | null>(null);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [showMealPhotoModal, setShowMealPhotoModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // Track previous calorie percentage for confetti trigger
  const prevCaloriePercentageRef = useRef<number | null>(null);
  const hasShownConfettiRef = useRef(false);

  // Fetch period data when period or date changes
  useEffect(() => {
    if (selectedPeriod === 'daily') {
      setPeriodSummary(null);
      return;
    }

    const fetchPeriodData = async () => {
      setPeriodLoading(true);
      try {
        let url: string;
        if (selectedPeriod === 'weekly') {
          url = `/api/consumption/weekly?date=${selectedDate}`;
        } else {
          const date = new Date(selectedDate);
          url = `/api/consumption/monthly?year=${date.getFullYear()}&month=${date.getMonth() + 1}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setPeriodSummary(data);
        }
      } catch (error) {
        console.error('Error fetching period data:', error);
      }
      setPeriodLoading(false);
    };

    fetchPeriodData();
  }, [selectedPeriod, selectedDate]);

  // Refresh data for current date
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, availableRes] = await Promise.all([
        fetch(`/api/consumption/daily?date=${selectedDate}`),
        fetch(`/api/consumption/available?date=${selectedDate}`),
      ]);
      if (summaryRes.ok && availableRes.ok) {
        setSummary(await summaryRes.json());
        setAvailable(await availableRes.json());
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
    setLoading(false);
  }, [selectedDate]);

  // Handle date change
  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setLoading(true);
    try {
      const [summaryRes, availableRes] = await Promise.all([
        fetch(`/api/consumption/daily?date=${newDate}`),
        fetch(`/api/consumption/available?date=${newDate}`),
      ]);
      if (summaryRes.ok && availableRes.ok) {
        setSummary(await summaryRes.json());
        setAvailable(await availableRes.json());
      }
    } catch (error) {
      console.error('Error loading date:', error);
    }
    setLoading(false);
  };

  // Log a meal (optimistic update)
  const handleLogMeal = async (meal: MealToLog) => {
    // Optimistic update
    const optimisticEntry: ConsumptionEntry = {
      id: `temp-${Date.now()}`,
      user_id: '',
      entry_type: meal.source,
      display_name: meal.name,
      meal_type: meal.meal_type,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      consumed_at: new Date().toISOString(),
      consumed_date: selectedDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSummary((prev) => ({
      ...prev,
      consumed: {
        calories: prev.consumed.calories + meal.calories,
        protein: prev.consumed.protein + meal.protein,
        carbs: prev.consumed.carbs + meal.carbs,
        fat: prev.consumed.fat + meal.fat,
      },
      entries: [...prev.entries, optimisticEntry],
      entry_count: prev.entry_count + 1,
    }));

    // Update available meals to show as logged
    updateMealLoggedStatus(meal.id, meal.source, true, optimisticEntry.id);

    try {
      // Build request payload, including meal_id for meal_plan type as fallback
      const payload: { type: string; source_id: string; meal_id?: string; consumed_at: string } = {
        type: meal.source,
        source_id: meal.source_id,
        consumed_at: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
      };
      // For meal plan meals, include meal_id as fallback in case meal_plan_meals record is deleted
      if (meal.source === 'meal_plan' && 'meal_id' in meal) {
        payload.meal_id = (meal as MealPlanMealToLog).meal_id;
      }

      const response = await fetch('/api/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const entry = await response.json();
        // Replace optimistic entry with real one
        setSummary((prev) => ({
          ...prev,
          entries: prev.entries.map((e) => (e.id === optimisticEntry.id ? entry : e)),
        }));
        updateMealLoggedStatus(meal.id, meal.source, true, entry.id, entry.consumed_at);
      } else {
        // Revert on error
        await refreshData();
      }
    } catch (error) {
      console.error('Error logging meal:', error);
      await refreshData();
    }
  };

  // Undo/remove a logged entry
  const handleUndoLog = async (entryId: string, meal: MealToLog) => {
    // Find the entry
    const entry = summary.entries.find((e) => e.id === entryId);
    if (!entry) return;

    // Optimistic update
    setSummary((prev) => ({
      ...prev,
      consumed: {
        calories: prev.consumed.calories - entry.calories,
        protein: prev.consumed.protein - entry.protein,
        carbs: prev.consumed.carbs - entry.carbs,
        fat: prev.consumed.fat - entry.fat,
      },
      entries: prev.entries.filter((e) => e.id !== entryId),
      entry_count: prev.entry_count - 1,
    }));

    updateMealLoggedStatus(meal.id, meal.source, false);

    try {
      const response = await fetch(`/api/consumption/${entryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        await refreshData();
      }
    } catch (error) {
      console.error('Error removing entry:', error);
      await refreshData();
    }
  };

  // Log an ingredient
  const handleLogIngredient = async (ingredient: IngredientToLog, amount: number, unit: string) => {
    const totalMacros = {
      calories: Math.round(ingredient.calories_per_serving * amount),
      protein: Math.round(ingredient.protein_per_serving * amount * 10) / 10,
      carbs: Math.round(ingredient.carbs_per_serving * amount * 10) / 10,
      fat: Math.round(ingredient.fat_per_serving * amount * 10) / 10,
    };

    // Optimistic update
    const optimisticEntry: ConsumptionEntry = {
      id: `temp-${Date.now()}`,
      user_id: '',
      entry_type: 'ingredient',
      ingredient_name: ingredient.name,
      display_name: ingredient.name,
      amount,
      unit,
      ...totalMacros,
      consumed_at: new Date().toISOString(),
      consumed_date: selectedDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSummary((prev) => ({
      ...prev,
      consumed: {
        calories: prev.consumed.calories + totalMacros.calories,
        protein: prev.consumed.protein + totalMacros.protein,
        carbs: prev.consumed.carbs + totalMacros.carbs,
        fat: prev.consumed.fat + totalMacros.fat,
      },
      entries: [...prev.entries, optimisticEntry],
      entry_count: prev.entry_count + 1,
    }));

    setSelectedIngredient(null);

    try {
      const response = await fetch('/api/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ingredient',
          ingredient_name: ingredient.name,
          amount,
          unit,
          ...totalMacros,
          consumed_at: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
        }),
      });

      if (response.ok) {
        const entry = await response.json();
        setSummary((prev) => ({
          ...prev,
          entries: prev.entries.map((e) => (e.id === optimisticEntry.id ? entry : e)),
        }));
        // Refresh to get updated frequent ingredients
        await refreshData();
      } else {
        await refreshData();
      }
    } catch (error) {
      console.error('Error logging ingredient:', error);
      await refreshData();
    }
  };

  // Repeat yesterday's meals
  const handleRepeatYesterday = async () => {
    setLoading(true);
    try {
      const yesterday = new Date(selectedDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const response = await fetch('/api/consumption/repeat-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDate: yesterdayStr,
          targetDate: selectedDate,
        }),
      });

      if (response.ok) {
        await refreshData();
      }
    } catch (error) {
      console.error('Error repeating yesterday:', error);
    }
    setLoading(false);
  };

  // Helper to update meal logged status in available lists
  const updateMealLoggedStatus = (
    mealId: string,
    source: string,
    isLogged: boolean,
    entryId?: string,
    loggedAt?: string
  ) => {
    setAvailable((prev) => {
      const updateList = (list: MealToLog[]) =>
        list.map((m) =>
          m.id === mealId ? { ...m, is_logged: isLogged, logged_entry_id: entryId, logged_at: loggedAt } : m
        );

      const updatePlanList = (list: MealPlanMealToLog[]) =>
        list.map((m) =>
          m.id === mealId ? { ...m, is_logged: isLogged, logged_entry_id: entryId, logged_at: loggedAt } : m
        );

      return {
        ...prev,
        from_todays_plan: source === 'meal_plan' ? updateList(prev.from_todays_plan) : prev.from_todays_plan,
        from_week_plan: source === 'meal_plan' ? updateList(prev.from_week_plan) : prev.from_week_plan,
        latest_plan_meals: source === 'meal_plan' ? updatePlanList(prev.latest_plan_meals || []) : (prev.latest_plan_meals || []),
        custom_meals: source === 'custom_meal' ? updateList(prev.custom_meals) : prev.custom_meals,
        quick_cook_meals: source === 'quick_cook' ? updateList(prev.quick_cook_meals) : prev.quick_cook_meals,
        recent_meals: prev.recent_meals,
        frequent_ingredients: prev.frequent_ingredients,
        pinned_ingredients: prev.pinned_ingredients || [],
      };
    });
  };

  // Recalculate percentages when summary changes
  const percentages: Macros = {
    calories:
      summary.targets.calories > 0 ? Math.round((summary.consumed.calories / summary.targets.calories) * 100) : 0,
    protein: summary.targets.protein > 0 ? Math.round((summary.consumed.protein / summary.targets.protein) * 100) : 0,
    carbs: summary.targets.carbs > 0 ? Math.round((summary.consumed.carbs / summary.targets.carbs) * 100) : 0,
    fat: summary.targets.fat > 0 ? Math.round((summary.consumed.fat / summary.targets.fat) * 100) : 0,
  };

  // Trigger confetti when hitting calorie goal
  useEffect(() => {
    const currentPercentage = percentages.calories;
    const prevPercentage = prevCaloriePercentageRef.current;

    // Only trigger if:
    // 1. We have a previous value (not initial load)
    // 2. We crossed the 100% threshold (was below, now at or above)
    // 3. We haven't already shown confetti for this date
    if (
      prevPercentage !== null &&
      prevPercentage < 100 &&
      currentPercentage >= 100 &&
      !hasShownConfettiRef.current
    ) {
      hasShownConfettiRef.current = true;

      // Fire confetti from both sides
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }

    prevCaloriePercentageRef.current = currentPercentage;
  }, [percentages.calories]);

  // Reset confetti flag when date changes
  useEffect(() => {
    hasShownConfettiRef.current = false;
    prevCaloriePercentageRef.current = null;
  }, [selectedDate]);

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Get time-based suggested meals from today's plan
  const suggestedMealTypes = getTimeBasedMealTypes();
  const suggestedMeals = available.from_todays_plan
    .filter((m) => m.meal_type && suggestedMealTypes.includes(m.meal_type) && !m.is_logged)
    .slice(0, 3);

  // Combine custom meals and quick cook for "My Meals" section
  // Meal plan meals are shown separately in the MealPlanMealsSection with search functionality
  const myMeals: MealToLog[] = [
    ...available.custom_meals,
    ...available.quick_cook_meals,
  ];

  // latest_plan_meals contains meals from the most recent meal plan only
  // Search functionality in MealPlanMealsSection allows finding meals from older plans
  const latestPlanMeals = available.latest_plan_meals || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
            Coach Hill&apos;s FuelRx
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/community" className="text-gray-600 hover:text-gray-900">
              Community
            </Link>
            <Link href="/custom-meals" className="text-gray-600 hover:text-gray-900">
              My Meals
            </Link>
            <Link href="/history" className="text-gray-600 hover:text-gray-900">
              My Plans
            </Link>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Log What I Ate</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="input-field w-auto"
          />
        </div>

        {/* Period Tabs */}
        <PeriodTabs selected={selectedPeriod} onChange={setSelectedPeriod} />

        {/* Loading overlay */}
        {(loading || periodLoading) && (
          <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-40">
            <div className="text-gray-600">Loading...</div>
          </div>
        )}

        {/* Weekly/Monthly View */}
        {selectedPeriod !== 'daily' && periodSummary && (
          <>
            <PeriodProgressCard summary={periodSummary} dailyTargets={summary.targets} />
            <TrendChart
              dailyData={periodSummary.dailyData}
              dailyTargets={summary.targets}
              periodType={periodSummary.periodType}
            />
          </>
        )}

        {/* Daily View */}
        {selectedPeriod === 'daily' && (
          <>
            {/* Daily Progress */}
            <DailyProgressCard
              date={selectedDate}
              targets={summary.targets}
              consumed={summary.consumed}
              percentages={percentages}
              entryCount={summary.entry_count}
            />

            {/* Quick Actions: Same as Yesterday */}
            {summary.entries.length === 0 && (
              <div className="mt-4">
                <button
                  onClick={handleRepeatYesterday}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Log same as yesterday
                </button>
              </div>
            )}

            {/* Today's Plan with Time-Based Suggestions */}
            {available.from_todays_plan.length > 0 && (
              <div className="mt-6">
                <MealSourceSection
                  title="From Today's Plan"
                  icon="calendar"
                  meals={available.from_todays_plan}
                  onLogMeal={handleLogMeal}
                  onUndoLog={handleUndoLog}
                />
                {/* Time-based suggestion badge */}
                {suggestedMeals.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2 ml-7">
                    Suggested now: {suggestedMeals.map(m => m.name).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Snap a Meal Button */}
            <div className="mt-6">
              <button
                onClick={() => setShowMealPhotoModal(true)}
                className="w-full flex items-center justify-center gap-3 py-4 px-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all shadow-md"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">Snap a Meal</span>
                <span className="text-sm opacity-90">Photo analysis with AI</span>
              </button>
            </div>

            {/* Quick Add Ingredients - Search-first design */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </span>
                Quick Add Ingredients
              </h3>
              <IngredientSearchBar
                frequentIngredients={available.frequent_ingredients}
                pinnedIngredients={available.pinned_ingredients || []}
                onSelectIngredient={setSelectedIngredient}
                onScanBarcode={() => setShowBarcodeModal(true)}
                onAddManually={() => setShowIngredientSearch(true)}
              />
            </div>

            {/* Logged Today Section - MOVED UP for visibility */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-green-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                Logged Today
                <span className="text-sm font-normal text-gray-500">
                  ({summary.entry_count} items)
                </span>
              </h3>
              {summary.entries.length > 0 ? (
                <div className="card divide-y divide-gray-100">
                  {summary.entries.map((entry) => (
                    <div key={entry.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{entry.display_name}</p>
                        <p className="text-sm text-gray-500">
                          {entry.calories} cal | {entry.protein}g P | {entry.carbs}g C | {entry.fat}g F
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          // Find the matching meal to pass to undo
                          const meal = [
                            ...available.from_todays_plan,
                            ...available.from_week_plan,
                            ...available.custom_meals,
                            ...available.quick_cook_meals,
                            ...(available.latest_plan_meals || []),
                          ].find((m) => m.logged_entry_id === entry.id);
                          if (meal) {
                            handleUndoLog(entry.id, meal);
                          } else {
                            // For ingredients, just delete directly
                            handleUndoLog(entry.id, {
                              id: entry.id,
                              source: entry.entry_type,
                              source_id: entry.id,
                              name: entry.display_name,
                              calories: entry.calories,
                              protein: entry.protein,
                              carbs: entry.carbs,
                              fat: entry.fat,
                              is_logged: true,
                              logged_entry_id: entry.id,
                            });
                          }
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <p className="text-sm">Nothing logged yet today</p>
                </div>
              )}
            </div>

            {/* My Meals - Custom meals and quick cook */}
            {myMeals.length > 0 && (
              <MealSourceSection
                title="My Meals"
                subtitle="Custom meals and quick cook creations"
                icon="utensils"
                meals={myMeals}
                onLogMeal={handleLogMeal}
                onUndoLog={handleUndoLog}
                collapsible
                initialCollapsed
                showMealSource
              />
            )}

            {/* Meal Plan Meals - Searchable section for finding historical meals */}
            {latestPlanMeals.length > 0 && (
              <MealPlanMealsSection
                latestPlanMeals={latestPlanMeals}
                latestPlanWeekStart={available.latest_plan_meals?.[0]?.plan_week_start}
                latestPlanTitle={available.latest_plan_meals?.[0]?.plan_title}
                onLogMeal={handleLogMeal}
                onUndoLog={handleUndoLog}
              />
            )}

            {/* Empty state */}
            {available.from_todays_plan.length === 0 &&
              available.custom_meals.length === 0 &&
              available.quick_cook_meals.length === 0 &&
              available.from_week_plan.length === 0 &&
              latestPlanMeals.length === 0 && (
                <div className="mt-8 text-center py-12 card">
                  <p className="text-gray-500 mb-4">No meals available to log.</p>
                  <Link href="/dashboard" className="btn-primary">
                    Generate a Meal Plan
                  </Link>
                </div>
              )}
          </>
        )}

        {/* Ingredient Amount Picker Modal */}
        {selectedIngredient && (
          <IngredientAmountPicker
            ingredient={selectedIngredient}
            isOpen={!!selectedIngredient}
            onClose={() => setSelectedIngredient(null)}
            onLog={handleLogIngredient}
          />
        )}

        {/* Add Ingredient Modal (for manual entry or barcode) */}
        <AddIngredientModal
          isOpen={showIngredientSearch || showBarcodeModal}
          onClose={() => {
            setShowIngredientSearch(false);
            setShowBarcodeModal(false);
          }}
          onSelectIngredient={(ing) => {
            setShowIngredientSearch(false);
            setShowBarcodeModal(false);
            setSelectedIngredient(ing);
          }}
        />

        {/* Meal Photo Modal */}
        <MealPhotoModal
          isOpen={showMealPhotoModal}
          onClose={() => setShowMealPhotoModal(false)}
          selectedDate={selectedDate}
          onMealLogged={(entry) => {
            // Add the new entry to the summary optimistically
            setSummary((prev) => ({
              ...prev,
              consumed: {
                calories: prev.consumed.calories + entry.calories,
                protein: prev.consumed.protein + entry.protein,
                carbs: prev.consumed.carbs + entry.carbs,
                fat: prev.consumed.fat + entry.fat,
              },
              entries: [...prev.entries, entry],
              entry_count: prev.entry_count + 1,
            }));
            // Refresh data to get accurate totals
            refreshData();
          }}
        />
      </main>
    </div>
  );
}
