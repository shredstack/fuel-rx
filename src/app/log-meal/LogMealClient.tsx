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
  IngredientCategoryType,
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
import MealTypeBreakdownChart from '@/components/consumption/MealTypeBreakdownChart';
import MealTypeSelector from '@/components/consumption/MealTypeSelector';
import ProduceExtractorModal from '@/components/consumption/ProduceExtractorModal';
import { MEAL_TYPE_LABELS } from '@/lib/types';
import Logo from '@/components/Logo';
import Navbar from '@/components/Navbar';
import MobileTabBar from '@/components/MobileTabBar';

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

// Helper to get today's date in user's local timezone as YYYY-MM-DD
function getLocalTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // Meal type selection state for logging
  const [pendingLogMeal, setPendingLogMeal] = useState<MealToLog | null>(null);
  const [pendingMealType, setPendingMealType] = useState<MealType | null>(null);

  // Produce extraction modal state (for 800g tracking after meal log)
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [pendingProduceMealId, setPendingProduceMealId] = useState<string | null>(null);
  const [pendingProduceMealName, setPendingProduceMealName] = useState<string>('');
  const [pendingProduceMealType, setPendingProduceMealType] = useState<MealType | null>(null);

  // Track previous calorie percentage for confetti trigger
  const prevCaloriePercentageRef = useRef<number | null>(null);
  const hasShownConfettiRef = useRef(false);

  // Track previous fruit/veg percentage for 800g confetti trigger
  const prevFruitVegPercentageRef = useRef<number | null>(null);
  const hasShownFruitVegConfettiRef = useRef(false);

  // On mount, check if server-provided date matches client's local date
  // If not (due to timezone mismatch), correct it to user's local today
  useEffect(() => {
    const localToday = getLocalTodayString();
    if (initialDate !== localToday) {
      // Server date doesn't match client's local date - refetch with correct date
      setSelectedDate(localToday);
      setLoading(true);
      Promise.all([
        fetch(`/api/consumption/daily?date=${localToday}`),
        fetch(`/api/consumption/available?date=${localToday}`),
      ])
        .then(async ([summaryRes, availableRes]) => {
          if (summaryRes.ok && availableRes.ok) {
            setSummary(await summaryRes.json());
            setAvailable(await availableRes.json());
          }
        })
        .catch((error) => {
          console.error('Error correcting date:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Start meal logging - show meal type selector first
  const handleLogMeal = async (meal: MealToLog) => {
    // Set pending meal and default to meal's original type
    setPendingLogMeal(meal);
    setPendingMealType(meal.meal_type || getTimeBasedMealTypes()[0]);
  };

  // Actually log the meal after type confirmation
  const confirmLogMeal = async () => {
    if (!pendingLogMeal || !pendingMealType) return;

    const meal = pendingLogMeal;
    const mealType = pendingMealType;

    // Clear pending state
    setPendingLogMeal(null);
    setPendingMealType(null);

    // Optimistic update
    const optimisticEntry: ConsumptionEntry = {
      id: `temp-${Date.now()}`,
      user_id: '',
      entry_type: meal.source,
      display_name: meal.name,
      meal_type: mealType,
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
      const payload: { type: string; source_id: string; meal_id?: string; meal_type: MealType; consumed_at: string } = {
        type: meal.source,
        source_id: meal.source_id,
        meal_type: mealType,
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

        // Check if this meal has a meal_id (meaning it has ingredients we can extract)
        // Trigger produce extraction modal for 800g tracking
        const mealIdForProduce = entry.meal_id || ('meal_id' in meal ? (meal as MealPlanMealToLog).meal_id : null);
        if (mealIdForProduce) {
          // Check if meal has produce before showing modal
          try {
            const checkResponse = await fetch(`/api/consumption/extract-produce?meal_id=${mealIdForProduce}`);
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              if (checkData.hasProduce) {
                setPendingProduceMealId(mealIdForProduce);
                setPendingProduceMealName(meal.name);
                setPendingProduceMealType(mealType);
                setShowProduceModal(true);
              }
            }
          } catch (e) {
            // Silently fail - don't block the main logging flow
            console.error('Error checking for produce:', e);
          }
        }
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

  // Move a logged entry to a different meal type
  const handleMoveMealType = async (entryId: string, newMealType: MealType) => {
    // Find the entry
    const entry = summary.entries.find((e) => e.id === entryId);
    if (!entry || entry.meal_type === newMealType) return;

    // Optimistic update
    setSummary((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === entryId ? { ...e, meal_type: newMealType } : e
      ),
    }));

    try {
      const response = await fetch(`/api/consumption/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_type: newMealType }),
      });

      if (!response.ok) {
        await refreshData();
      }
    } catch (error) {
      console.error('Error moving entry:', error);
      await refreshData();
    }
  };

  // Log an ingredient
  const handleLogIngredient = async (
    ingredient: IngredientToLog,
    amount: number,
    unit: string,
    mealType: MealType,
    grams?: number,
    category?: IngredientCategoryType
  ) => {
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
      meal_type: mealType,
      amount,
      unit,
      grams,
      ingredient_category: category,
      ...totalMacros,
      consumed_at: new Date().toISOString(),
      consumed_date: selectedDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically update fruit/veg progress
    setSummary((prev) => {
      const newSummary = {
        ...prev,
        consumed: {
          calories: prev.consumed.calories + totalMacros.calories,
          protein: prev.consumed.protein + totalMacros.protein,
          carbs: prev.consumed.carbs + totalMacros.carbs,
          fat: prev.consumed.fat + totalMacros.fat,
        },
        entries: [...prev.entries, optimisticEntry],
        entry_count: prev.entry_count + 1,
      };

      // Update fruit/veg progress if applicable
      if (grams && category && ['fruit', 'vegetable'].includes(category) && prev.fruitVeg) {
        newSummary.fruitVeg = {
          ...prev.fruitVeg,
          currentGrams: prev.fruitVeg.currentGrams + grams,
          percentage: Math.round(((prev.fruitVeg.currentGrams + grams) / prev.fruitVeg.goalGrams) * 100),
        };
      }

      return newSummary;
    });

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
          meal_type: mealType,
          grams,
          category,
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
        // Refresh to get updated frequent ingredients and accurate fruit/veg totals
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
    hasShownFruitVegConfettiRef.current = false;
    prevFruitVegPercentageRef.current = null;
  }, [selectedDate]);

  // Trigger confetti when hitting 800g fruit/veg goal
  useEffect(() => {
    if (!summary.fruitVeg) return;

    const currentPercentage = summary.fruitVeg.percentage;
    const prevPercentage = prevFruitVegPercentageRef.current;

    // Only trigger if:
    // 1. We have a previous value (not initial load)
    // 2. We crossed the 100% threshold (was below, now at or above)
    // 3. We haven't already shown confetti for this date
    // 4. Server hasn't marked it as already celebrated
    if (
      prevPercentage !== null &&
      prevPercentage < 100 &&
      currentPercentage >= 100 &&
      !hasShownFruitVegConfettiRef.current &&
      !summary.fruitVeg.goalCelebrated
    ) {
      hasShownFruitVegConfettiRef.current = true;

      // Fire confetti with green/veggie colors from both sides
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'],  // Green palette
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // Mark as celebrated on the server
      fetch('/api/consumption/celebrate-fruit-veg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      }).catch(console.error);
    }

    prevFruitVegPercentageRef.current = currentPercentage;
  }, [summary.fruitVeg, selectedDate]);

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
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

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
            <div className="mt-4">
              <TrendChart
                dailyData={periodSummary.dailyData}
                dailyTargets={summary.targets}
                periodType={periodSummary.periodType}
              />
            </div>
            <div className="mt-4">
              <MealTypeBreakdownChart
                breakdown={periodSummary.byMealType}
                totalConsumed={periodSummary.consumed}
              />
            </div>
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
              fruitVeg={summary.fruitVeg}
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

            {/* Logged Today Section - Grouped by meal type */}
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
                <div className="space-y-4">
                  {/* Group entries by meal type */}
                  {(['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'] as MealType[]).map((mealType) => {
                    const entriesForType = summary.entries.filter((e) => e.meal_type === mealType);
                    if (entriesForType.length === 0) return null;

                    const typeTotals = entriesForType.reduce(
                      (acc, e) => ({
                        calories: acc.calories + e.calories,
                        protein: acc.protein + e.protein,
                        carbs: acc.carbs + e.carbs,
                        fat: acc.fat + e.fat,
                      }),
                      { calories: 0, protein: 0, carbs: 0, fat: 0 }
                    );

                    return (
                      <div key={mealType} className="card">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            <span className="text-primary-500">{MEAL_TYPE_LABELS[mealType]}</span>
                            <span className="text-xs text-gray-400">({entriesForType.length})</span>
                          </h4>
                          <span className="text-xs text-gray-500">
                            {typeTotals.calories} cal
                          </span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {entriesForType.map((entry) => (
                            <div key={entry.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                  {entry.display_name}
                                  {/* 800g Challenge indicator for fruits/vegetables */}
                                  {entry.ingredient_category === 'fruit' && <span title="Fruit - counts toward 800g">🍎</span>}
                                  {entry.ingredient_category === 'vegetable' && <span title="Vegetable - counts toward 800g">🥬</span>}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {entry.calories} cal | {entry.protein}g P | {entry.carbs}g C | {entry.fat}g F
                                  {/* Show grams for fruit/veg items */}
                                  {entry.grams && (entry.ingredient_category === 'fruit' || entry.ingredient_category === 'vegetable') && (
                                    <span className="text-green-600 ml-1">| {entry.grams}g</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Move to different meal type dropdown */}
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleMoveMealType(entry.id, e.target.value as MealType);
                                    }
                                  }}
                                  className="text-xs text-gray-600 bg-gray-100 border-0 rounded px-2 py-1 cursor-pointer hover:bg-gray-200 focus:ring-1 focus:ring-primary-500"
                                  title="Move to different meal"
                                >
                                  <option value="">Move to...</option>
                                  {(['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'] as MealType[])
                                    .filter((mt) => mt !== mealType)
                                    .map((mt) => (
                                      <option key={mt} value={mt}>
                                        {MEAL_TYPE_LABELS[mt]}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  onClick={() => {
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
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned entries (legacy data without meal_type) */}
                  {(() => {
                    const unassignedEntries = summary.entries.filter((e) => !e.meal_type);
                    if (unassignedEntries.length === 0) return null;

                    return (
                      <div className="card">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                          <h4 className="font-medium text-gray-500 flex items-center gap-2">
                            <span>Other</span>
                            <span className="text-xs text-gray-400">({unassignedEntries.length})</span>
                          </h4>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {unassignedEntries.map((entry) => (
                            <div key={entry.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{entry.display_name}</p>
                                <p className="text-xs text-gray-500">
                                  {entry.calories} cal | {entry.protein}g P | {entry.carbs}g C | {entry.fat}g F
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Assign meal type dropdown */}
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleMoveMealType(entry.id, e.target.value as MealType);
                                    }
                                  }}
                                  className="text-xs text-gray-600 bg-gray-100 border-0 rounded px-2 py-1 cursor-pointer hover:bg-gray-200 focus:ring-1 focus:ring-primary-500"
                                  title="Assign to meal type"
                                >
                                  <option value="">Assign to...</option>
                                  {(['breakfast', 'pre_workout', 'lunch', 'post_workout', 'snack', 'dinner'] as MealType[]).map((mt) => (
                                    <option key={mt} value={mt}>
                                      {MEAL_TYPE_LABELS[mt]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
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
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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

        {/* Meal Type Confirmation Modal */}
        {pendingLogMeal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Log &ldquo;{pendingLogMeal.name}&rdquo;
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {pendingLogMeal.calories} cal | {pendingLogMeal.protein}g P | {pendingLogMeal.carbs}g C | {pendingLogMeal.fat}g F
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log as:
                </label>
                <MealTypeSelector
                  value={pendingMealType}
                  onChange={setPendingMealType}
                  suggestedTypes={getTimeBasedMealTypes()}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPendingLogMeal(null);
                    setPendingMealType(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogMeal}
                  disabled={!pendingMealType}
                  className="flex-1 px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Log
                </button>
              </div>
            </div>
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

        {/* Produce Extractor Modal (for 800g tracking after meal log) */}
        {showProduceModal && pendingProduceMealId && pendingProduceMealType && (
          <ProduceExtractorModal
            isOpen={showProduceModal}
            onClose={() => {
              setShowProduceModal(false);
              setPendingProduceMealId(null);
              setPendingProduceMealName('');
              setPendingProduceMealType(null);
            }}
            mealId={pendingProduceMealId}
            mealName={pendingProduceMealName}
            mealType={pendingProduceMealType}
            selectedDate={selectedDate}
            onIngredientsLogged={(entries) => {
              // Add the new produce entries to the summary
              if (entries.length > 0) {
                const totalGrams = entries.reduce((sum, e) => sum + (e.grams || 0), 0);
                setSummary((prev) => {
                  const currentFruitVegGrams = prev.fruitVeg?.currentGrams || 0;
                  const goalGrams = prev.fruitVeg?.goalGrams || 800;
                  return {
                    ...prev,
                    entries: [...prev.entries, ...entries],
                    entry_count: prev.entry_count + entries.length,
                    fruitVeg: prev.fruitVeg ? {
                      ...prev.fruitVeg,
                      currentGrams: currentFruitVegGrams + totalGrams,
                      percentage: Math.round(((currentFruitVegGrams + totalGrams) / goalGrams) * 100),
                    } : undefined,
                  };
                });
              }
              // Refresh to get accurate totals
              refreshData();
            }}
          />
        )}
      </main>

      <MobileTabBar />
    </div>
  );
}
