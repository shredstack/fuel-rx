'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type {
  DailyConsumptionSummary,
  AvailableMealsToLog,
  MealToLog,
  IngredientToLog,
  ConsumptionEntry,
  Macros,
} from '@/lib/types';
import DailyProgressCard from '@/components/consumption/DailyProgressCard';
import MealSourceSection from '@/components/consumption/MealSourceSection';
import IngredientQuickAdd from '@/components/consumption/IngredientQuickAdd';
import IngredientAmountPicker from '@/components/consumption/IngredientAmountPicker';
import IngredientSearchModal from '@/components/consumption/IngredientSearchModal';

interface Props {
  initialDate: string;
  initialSummary: DailyConsumptionSummary;
  initialAvailable: AvailableMealsToLog;
}

export default function LogMealClient({ initialDate, initialSummary, initialAvailable }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [summary, setSummary] = useState(initialSummary);
  const [available, setAvailable] = useState(initialAvailable);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientToLog | null>(null);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);

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
      const response = await fetch('/api/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: meal.source,
          source_id: meal.source_id,
        }),
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

      return {
        ...prev,
        from_todays_plan: source === 'meal_plan' ? updateList(prev.from_todays_plan) : prev.from_todays_plan,
        from_week_plan: source === 'meal_plan' ? updateList(prev.from_week_plan) : prev.from_week_plan,
        custom_meals: source === 'custom_meal' ? updateList(prev.custom_meals) : prev.custom_meals,
        quick_cook_meals: source === 'quick_cook' ? updateList(prev.quick_cook_meals) : prev.quick_cook_meals,
        recent_meals: prev.recent_meals,
        frequent_ingredients: prev.frequent_ingredients,
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

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

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

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-40">
            <div className="text-gray-600">Loading...</div>
          </div>
        )}

        {/* Daily Progress */}
        <DailyProgressCard
          date={selectedDate}
          targets={summary.targets}
          consumed={summary.consumed}
          percentages={percentages}
          entryCount={summary.entry_count}
        />

        {/* Today's Plan */}
        {available.from_todays_plan.length > 0 && (
          <MealSourceSection
            title="From Today's Plan"
            icon="calendar"
            meals={available.from_todays_plan}
            onLogMeal={handleLogMeal}
            onUndoLog={handleUndoLog}
          />
        )}

        {/* Quick Add Ingredients */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">Quick Add Ingredients</h3>
          <IngredientQuickAdd
            ingredients={available.frequent_ingredients}
            onSelectIngredient={setSelectedIngredient}
            onAddOther={() => setShowIngredientSearch(true)}
          />
        </div>

        {/* My Recipes */}
        {available.custom_meals.length > 0 && (
          <MealSourceSection
            title="My Recipes"
            icon="utensils"
            meals={available.custom_meals}
            onLogMeal={handleLogMeal}
            onUndoLog={handleUndoLog}
            collapsible
          />
        )}

        {/* Quick Cook */}
        {available.quick_cook_meals.length > 0 && (
          <MealSourceSection
            title="Quick Cook"
            icon="bolt"
            meals={available.quick_cook_meals}
            onLogMeal={handleLogMeal}
            onUndoLog={handleUndoLog}
            collapsible
          />
        )}

        {/* Other Days This Week */}
        {available.from_week_plan.length > 0 && (
          <MealSourceSection
            title="Other Days This Week"
            icon="calendar-week"
            meals={available.from_week_plan}
            onLogMeal={handleLogMeal}
            onUndoLog={handleUndoLog}
            collapsible
            initialCollapsed
          />
        )}

        {/* Logged Today Section */}
        {summary.entries.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Logged Today</h3>
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
                      const meal = [...available.from_todays_plan, ...available.from_week_plan, ...available.custom_meals, ...available.quick_cook_meals].find(
                        (m) => m.logged_entry_id === entry.id
                      );
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
          </div>
        )}

        {/* Empty state */}
        {available.from_todays_plan.length === 0 &&
          available.custom_meals.length === 0 &&
          available.quick_cook_meals.length === 0 &&
          available.from_week_plan.length === 0 && (
            <div className="mt-8 text-center py-12 card">
              <p className="text-gray-500 mb-4">No meals available to log.</p>
              <Link href="/dashboard" className="btn-primary">
                Generate a Meal Plan
              </Link>
            </div>
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

        {/* Ingredient Search Modal */}
        <IngredientSearchModal
          isOpen={showIngredientSearch}
          onClose={() => setShowIngredientSearch(false)}
          onSelectIngredient={(ing) => {
            setShowIngredientSearch(false);
            setSelectedIngredient(ing);
          }}
        />
      </main>
    </div>
  );
}
