'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useQueryClient } from '@tanstack/react-query';
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
  MealType,
  IngredientCategoryType,
  SelectableMealType,
  EditableIngredient,
  IngredientWithNutrition,
} from '@/lib/types';
import { useLogMealData, useWeeklyConsumption, useMonthlyConsumption, useConsumptionSummary, type PreviousEntriesByMealType } from '@/hooks/queries/useConsumption';
import { useMealIngredients } from '@/hooks/queries/useMealIngredients';
import {
  useLogMeal,
  useDeleteConsumptionEntry,
  useUpdateEntryMealType,
  useUpdateEntryAmount,
  useRepeatMealType,
  useRepeatYesterday,
  useAddWater,
  optimisticallyAddEntry,
  optimisticallyRemoveEntry,
  updateMealLoggedStatusInCache,
} from '@/hooks/queries/useConsumptionMutations';
import { queryKeys } from '@/lib/queryKeys';
import DailyProgressCard from '@/components/consumption/DailyProgressCard';
import MealSourceSection from '@/components/consumption/MealSourceSection';
import MealSection from '@/components/consumption/MealSection';
import IngredientSearchBar from '@/components/consumption/IngredientSearchBar';
import IngredientAmountPicker from '@/components/consumption/IngredientAmountPicker';
import AddIngredientModal from '@/components/consumption/AddIngredientModal';
import MealPhotoModal from '@/components/consumption/MealPhotoModal';
import MealPlanMealsSection from '@/components/consumption/MealPlanMealsSection';
import PeriodTabs from '@/components/consumption/PeriodTabs';
import PeriodProgressCard from '@/components/consumption/PeriodProgressCard';
import DailyAverageCard from '@/components/consumption/DailyAverageCard';
import TrendChart from '@/components/consumption/TrendChart';
import MealTypeBreakdownChart from '@/components/consumption/MealTypeBreakdownChart';
import SummaryView from '@/components/consumption/SummaryView';
import MealTypeSelector from '@/components/consumption/MealTypeSelector';
import MealIngredientEditor from '@/components/consumption/MealIngredientEditor';
import { MEAL_TYPE_LABELS } from '@/lib/types';
import Navbar from '@/components/Navbar';
import MobileTabBar from '@/components/MobileTabBar';

interface Props {
  initialDate: string;
  initialSummary: DailyConsumptionSummary;
  initialAvailable: AvailableMealsToLog;
  initialPreviousEntries: PreviousEntriesByMealType;
  userMealTypes: SelectableMealType[];
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

// Type for produce tracking in the meal log modal
interface DetectedProduceItem {
  name: string;
  amount: string;
  unit: string;
  category: 'fruit' | 'vegetable';
  estimatedGrams: number;
  isSelected: boolean;
  adjustedGrams: number;
}

// Convert meal ingredients to editable format
function ingredientsToEditable(ingredients: IngredientWithNutrition[]): EditableIngredient[] {
  return ingredients.map((ing) => {
    const amount = parseFloat(ing.amount) || 0;
    return {
      name: ing.name,
      amount,
      originalAmount: amount,
      unit: ing.unit,
      category: ing.category || 'other',
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
      isIncluded: true,
    };
  });
}

// Calculate total macros from editable ingredients
function calculateTotalMacros(ingredients: EditableIngredient[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  return ingredients
    .filter((ing) => ing.isIncluded && ing.amount > 0)
    .reduce(
      (acc, ing) => ({
        calories: acc.calories + ing.calories,
        protein: acc.protein + ing.protein,
        carbs: acc.carbs + ing.carbs,
        fat: acc.fat + ing.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

export default function LogMealClient({
  initialDate,
  initialSummary,
  initialAvailable,
  initialPreviousEntries,
  userMealTypes,
}: Props) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(initialDate);

  // Use React Query for data fetching with initial data from server
  const {
    summary: querySummary,
    available: queryAvailable,
    previousEntries: queryPreviousEntries,
    isLoading: queryLoading,
    isFetching,
  } = useLogMealData(selectedDate, {
    summary: initialSummary,
    available: initialAvailable,
    previousEntries: initialPreviousEntries,
    initialDate,
  });

  // Fallback to initial data while loading
  const summary = querySummary || initialSummary;
  const available = queryAvailable || initialAvailable;
  const previousEntries = queryPreviousEntries || initialPreviousEntries;
  const loading = queryLoading || isFetching;

  // Mutation hooks
  const logMealMutation = useLogMeal();
  const deleteEntryMutation = useDeleteConsumptionEntry();
  const updateMealTypeMutation = useUpdateEntryMealType();
  const updateAmountMutation = useUpdateEntryAmount();
  const repeatMealTypeMutation = useRepeatMealType();
  const repeatYesterdayMutation = useRepeatYesterday();
  const addWaterMutation = useAddWater();

  // Period view state
  const [selectedPeriod, setSelectedPeriod] = useState<ConsumptionPeriodType>('daily');

  // Period data via React Query (cached across tab switches)
  const [year, month] = selectedDate.split('-').map(Number);
  const weeklyQuery = useWeeklyConsumption(selectedDate, selectedPeriod === 'weekly');
  const monthlyQuery = useMonthlyConsumption(year, month, selectedPeriod === 'monthly');
  const summaryQuery = useConsumptionSummary(selectedPeriod === 'summary');
  const periodSummary = selectedPeriod === 'weekly'
    ? weeklyQuery.data ?? null
    : selectedPeriod === 'monthly'
      ? monthlyQuery.data ?? null
      : null;
  const periodLoading = selectedPeriod === 'weekly'
    ? weeklyQuery.isLoading
    : selectedPeriod === 'monthly'
      ? monthlyQuery.isLoading
      : selectedPeriod === 'summary'
        ? summaryQuery.isLoading
        : false;

  // Modal states
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientToLog | null>(null);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [showMealPhotoModal, setShowMealPhotoModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // Meal type selection state for logging
  const [pendingLogMeal, setPendingLogMeal] = useState<MealToLog | null>(null);
  const [pendingMealType, setPendingMealType] = useState<MealType | null>(null);

  // Ingredient editing state for meal plan meals
  const [showIngredientEditor, setShowIngredientEditor] = useState(false);
  const [editedIngredients, setEditedIngredients] = useState<EditableIngredient[] | null>(null);

  // Fetch meal ingredients when ingredient editor is shown
  const pendingMealId = pendingLogMeal?.source === 'meal_plan' && 'meal_id' in pendingLogMeal
    ? (pendingLogMeal as MealPlanMealToLog).meal_id
    : null;
  const { data: mealWithIngredients, isLoading: ingredientsLoading } = useMealIngredients(
    showIngredientEditor ? pendingMealId : null
  );

  // For adding new entry with pre-selected meal type
  const [addingToMealType, setAddingToMealType] = useState<MealType | null>(null);

  // Track which meal type was just logged to (for auto-expanding that section)
  const [recentlyLoggedToMealType, setRecentlyLoggedToMealType] = useState<MealType | null>(null);

  // Inline produce tracking state (for 800g tracking in meal log modal)
  const [detectedProduce, setDetectedProduce] = useState<DetectedProduceItem[]>([]);
  const [isLoadingProduce, setIsLoadingProduce] = useState(false);

  // Today's Meals section collapse state (expanded by default)
  const [isTodaysMealsCollapsed, setIsTodaysMealsCollapsed] = useState(false);

  // Track previous calorie percentage for confetti trigger
  const prevCaloriePercentageRef = useRef<number | null>(null);
  const hasShownConfettiRef = useRef(false);

  // Track previous fruit/veg percentage for 800g confetti trigger
  const prevFruitVegPercentageRef = useRef<number | null>(null);
  const hasShownFruitVegConfettiRef = useRef(false);

  // Track previous water percentage for confetti trigger
  const prevWaterPercentageRef = useRef<number | null>(null);
  const hasShownWaterConfettiRef = useRef(false);

  // Time-based meal suggestions - computed after mount to avoid hydration mismatch
  const [suggestedMealTypes, setSuggestedMealTypes] = useState<MealType[]>([]);

  // Ordered list of meal types based on user preferences
  // Section order: breakfast → lunch → dinner → pre_workout* → post_workout* → snack
  const orderedMealTypes: MealType[] = [
    'breakfast',
    'lunch',
    'dinner',
    'pre_workout',
    'post_workout',
    'snack',
  ].filter((type) => type === 'snack' || userMealTypes.includes(type as SelectableMealType)) as MealType[];

  // On mount, check if server-provided date matches client's local date
  // If not (due to timezone mismatch), correct it to user's local today
  // Also compute time-based meal suggestions after mount to avoid hydration mismatch
  useEffect(() => {
    const localToday = getLocalTodayString();
    if (initialDate !== localToday) {
      // Server date doesn't match client's local date - update to correct date
      // React Query will automatically fetch data for the new date
      setSelectedDate(localToday);
    }
    // Compute time-based suggestions after mount
    setSuggestedMealTypes(getTimeBasedMealTypes());
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize editable ingredients when meal data loads
  useEffect(() => {
    if (showIngredientEditor && mealWithIngredients?.ingredients && !editedIngredients) {
      setEditedIngredients(ingredientsToEditable(mealWithIngredients.ingredients));
    }
  }, [showIngredientEditor, mealWithIngredients, editedIngredients]);

  // Handle date change - React Query automatically fetches data for the new date
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    // React Query will automatically fetch data for the new date
    // If the data is already cached, it will be served instantly
  };

  // Start meal logging - show meal type selector first
  const handleLogMeal = async (meal: MealToLog) => {
    // Set pending meal and default to meal's original type
    setPendingLogMeal(meal);
    setPendingMealType(meal.meal_type || suggestedMealTypes[0] || 'breakfast');

    // Reset produce state
    setDetectedProduce([]);
    setIsLoadingProduce(false);

    // Fetch produce data for 800g tracking
    // - For meal_plan meals: use meal_id (the underlying meal ID from meals table)
    // - For custom_meal and quick_cook meals: use id (which IS the meal ID)
    const mealIdForProduce = meal.source === 'meal_plan'
      ? meal.meal_id
      : (meal.source === 'custom_meal' || meal.source === 'quick_cook')
        ? meal.id
        : null;

    console.log('[Produce Detection] Meal:', {
      name: meal.name,
      source: meal.source,
      id: meal.id,
      meal_id: meal.meal_id,
      mealIdForProduce
    });

    if (mealIdForProduce) {
      setIsLoadingProduce(true);
      try {
        const response = await fetch('/api/consumption/extract-produce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meal_id: mealIdForProduce }),
        });

        if (response.ok) {
          const data = await response.json();
          const items = data.produceIngredients || [];

          // Initialize produce items with selection state
          const initializedItems: DetectedProduceItem[] = items.map((item: {
            name: string;
            amount: string;
            unit: string;
            category: 'fruit' | 'vegetable';
            estimatedGrams: number;
          }) => ({
            ...item,
            isSelected: true,
            adjustedGrams: item.estimatedGrams,
          }));

          setDetectedProduce(initializedItems);
        } else {
          // Log API errors for debugging
          const errorData = await response.json().catch(() => ({}));
          console.error('Produce extraction API error:', response.status, errorData);
        }
      } catch (error) {
        console.error('Error fetching produce:', error);
      } finally {
        setIsLoadingProduce(false);
      }
    } else if (meal.source === 'meal_plan') {
      // Log when produce detection is skipped for meal_plan meals (missing meal_id)
      console.warn('Produce detection skipped: meal_plan meal missing meal_id', { mealId: meal.id, mealName: meal.name });
    }
  };

  // Actually log the meal after type confirmation
  const confirmLogMeal = async () => {
    if (!pendingLogMeal || !pendingMealType) return;

    const meal = pendingLogMeal;
    const mealType = pendingMealType;

    // Calculate macros - use edited ingredients if modified, otherwise use original meal macros
    const customMacros = editedIngredients ? calculateTotalMacros(editedIngredients) : null;
    const macrosToLog = customMacros || {
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    };

    // Capture selected produce items before clearing state
    const selectedProduceItems = detectedProduce.filter(p => p.isSelected && p.adjustedGrams > 0);

    // Clear pending state and ingredient editor
    setPendingLogMeal(null);
    setPendingMealType(null);
    setShowIngredientEditor(false);
    setEditedIngredients(null);
    setDetectedProduce([]);

    // Optimistic update with potentially modified macros
    const optimisticEntry: ConsumptionEntry = {
      id: `temp-${Date.now()}`,
      user_id: '',
      entry_type: meal.source,
      display_name: meal.name,
      meal_type: mealType,
      calories: Math.round(macrosToLog.calories),
      protein: Math.round(macrosToLog.protein * 10) / 10,
      carbs: Math.round(macrosToLog.carbs * 10) / 10,
      fat: Math.round(macrosToLog.fat * 10) / 10,
      consumed_at: new Date().toISOString(),
      consumed_date: selectedDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Apply optimistic updates to cache
    optimisticallyAddEntry(queryClient, selectedDate, optimisticEntry);
    updateMealLoggedStatusInCache(queryClient, selectedDate, meal.id, meal.source, true, optimisticEntry.id);

    // Auto-expand the meal section that was just logged to
    setRecentlyLoggedToMealType(mealType);
    // Also expand the "Today's Meals" section if collapsed
    setIsTodaysMealsCollapsed(false);

    // Build request payload
    const payload: {
      type: string;
      source_id: string;
      meal_id?: string;
      meal_type: MealType;
      consumed_at: string;
      custom_macros?: { calories: number; protein: number; carbs: number; fat: number };
    } = {
      type: meal.source,
      source_id: meal.source_id,
      meal_type: mealType,
      consumed_at: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
    };
    // For meal plan meals, include meal_id as fallback in case meal_plan_meals record is deleted
    if (meal.source === 'meal_plan' && 'meal_id' in meal) {
      payload.meal_id = (meal as MealPlanMealToLog).meal_id;
    }
    // Include custom macros if user modified portions
    if (customMacros) {
      payload.custom_macros = {
        calories: Math.round(customMacros.calories),
        protein: Math.round(customMacros.protein * 10) / 10,
        carbs: Math.round(customMacros.carbs * 10) / 10,
        fat: Math.round(customMacros.fat * 10) / 10,
      };
    }

    try {
      await logMealMutation.mutateAsync(payload as Parameters<typeof logMealMutation.mutateAsync>[0]);

      // Log selected produce items for 800g tracking (inline, no modal)
      if (selectedProduceItems.length > 0) {
        try {
          const produceResponse = await fetch('/api/consumption/log-produce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ingredients: selectedProduceItems.map((item) => ({
                name: item.name,
                category: item.category,
                grams: item.adjustedGrams,
              })),
              meal_type: mealType,
              consumed_at: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
            }),
          });

          if (produceResponse.ok) {
            const produceData = await produceResponse.json();
            const produceEntries = produceData.entries || [];

            // Optimistically update fruit/veg progress
            if (produceEntries.length > 0) {
              const totalGrams = selectedProduceItems.reduce((sum, p) => sum + p.adjustedGrams, 0);
              queryClient.setQueryData<DailyConsumptionSummary>(
                queryKeys.consumption.daily(selectedDate),
                (prev) => {
                  if (!prev) return prev;
                  const currentFruitVegGrams = prev.fruitVeg?.currentGrams || 0;
                  const goalGrams = prev.fruitVeg?.goalGrams || 800;
                  return {
                    ...prev,
                    entries: [...prev.entries, ...produceEntries],
                    entry_count: prev.entry_count + produceEntries.length,
                    fruitVeg: prev.fruitVeg ? {
                      ...prev.fruitVeg,
                      currentGrams: currentFruitVegGrams + totalGrams,
                      percentage: Math.round(((currentFruitVegGrams + totalGrams) / goalGrams) * 100),
                    } : undefined,
                  };
                }
              );
            }
          }
        } catch (e) {
          // Silently fail - don't block the main logging flow
          console.error('Error logging produce:', e);
        }
      }
    } catch (error) {
      // Mutation hook handles cache invalidation on error
      console.error('Error logging meal:', error);
    }
  };

  // Undo/remove a logged entry
  const handleUndoLog = async (entryId: string, meal: MealToLog) => {
    // Find the entry
    const entry = summary.entries.find((e) => e.id === entryId);
    if (!entry) return;

    // Apply optimistic updates to cache
    optimisticallyRemoveEntry(queryClient, selectedDate, entryId);
    updateMealLoggedStatusInCache(queryClient, selectedDate, meal.id, meal.source, false);

    try {
      await deleteEntryMutation.mutateAsync(entryId);
    } catch (error) {
      // Mutation hook handles cache invalidation on error
      console.error('Error removing entry:', error);
    }
  };

  // Move a logged entry to a different meal type
  const handleMoveMealType = async (entryId: string, newMealType: MealType) => {
    // Find the entry
    const entry = summary.entries.find((e) => e.id === entryId);
    if (!entry || entry.meal_type === newMealType) return;

    // Optimistic update to cache
    queryClient.setQueryData<DailyConsumptionSummary>(
      queryKeys.consumption.daily(selectedDate),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          entries: old.entries.map((e) =>
            e.id === entryId ? { ...e, meal_type: newMealType } : e
          ),
        };
      }
    );

    try {
      await updateMealTypeMutation.mutateAsync({ entryId, mealType: newMealType });
    } catch (error) {
      // Mutation hook handles cache invalidation on error
      console.error('Error moving entry:', error);
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

    // Optimistically update cache including fruit/veg progress
    queryClient.setQueryData<DailyConsumptionSummary>(
      queryKeys.consumption.daily(selectedDate),
      (prev) => {
        if (!prev) return prev;
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
      }
    );

    // Auto-expand the meal section that was just logged to
    setRecentlyLoggedToMealType(mealType);
    // Also expand the "Today's Meals" section if collapsed
    setIsTodaysMealsCollapsed(false);

    setSelectedIngredient(null);

    try {
      await logMealMutation.mutateAsync({
        type: 'ingredient',
        ingredient_name: ingredient.name,
        amount,
        unit,
        meal_type: mealType,
        grams,
        category,
        ...totalMacros,
        consumed_at: `${selectedDate}T${new Date().toTimeString().slice(0, 8)}`,
      });
      // Mutation hook handles cache invalidation to refresh frequent ingredients
    } catch (error) {
      // Mutation hook handles cache invalidation on error
      console.error('Error logging ingredient:', error);
    }
  };

  // Repeat yesterday's meals
  const handleRepeatYesterday = async () => {
    const yesterday = new Date(selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      await repeatYesterdayMutation.mutateAsync({
        sourceDate: yesterdayStr,
        targetDate: selectedDate,
      });
      // Mutation hook handles cache invalidation
    } catch (error) {
      console.error('Error repeating yesterday:', error);
    }
  };

  // Repeat a specific meal type from a previous day
  const handleRepeatMealType = async (mealType: MealType, sourceDate: string) => {
    try {
      await repeatMealTypeMutation.mutateAsync({
        mealType,
        sourceDate,
        targetDate: selectedDate,
      });
      // Auto-expand the meal section that was just logged to
      setRecentlyLoggedToMealType(mealType);
      // Also expand the "Today's Meals" section if collapsed
      setIsTodaysMealsCollapsed(false);
      // Mutation hook handles cache invalidation
    } catch (error) {
      console.error('Error repeating meal type:', error);
    }
  };

  // Update entry amount (for inline editing)
  const handleEditEntryAmount = async (
    entryId: string,
    newAmount: number,
    newMacros: { calories: number; protein: number; carbs: number; fat: number },
    newGrams?: number
  ) => {
    // Find the original entry to calculate the delta
    const originalEntry = summary.entries.find((e) => e.id === entryId);
    if (!originalEntry) return;

    const macroDelta = {
      calories: newMacros.calories - originalEntry.calories,
      protein: newMacros.protein - originalEntry.protein,
      carbs: newMacros.carbs - originalEntry.carbs,
      fat: newMacros.fat - originalEntry.fat,
    };

    // Optimistic update to cache
    queryClient.setQueryData<DailyConsumptionSummary>(
      queryKeys.consumption.daily(selectedDate),
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          consumed: {
            calories: prev.consumed.calories + macroDelta.calories,
            protein: prev.consumed.protein + macroDelta.protein,
            carbs: prev.consumed.carbs + macroDelta.carbs,
            fat: prev.consumed.fat + macroDelta.fat,
          },
          entries: prev.entries.map((e) =>
            e.id === entryId
              ? { ...e, amount: newAmount, ...newMacros, grams: newGrams ?? e.grams }
              : e
          ),
        };
      }
    );

    try {
      await updateAmountMutation.mutateAsync({
        entryId,
        amount: newAmount,
        ...newMacros,
        grams: newGrams,
      });
    } catch (error) {
      // Mutation hook handles cache invalidation on error
      console.error('Error updating entry amount:', error);
    }
  };

  // Handle adding entry from a meal section (pre-selects meal type)
  const handleAddFromSection = useCallback((mealType: MealType) => {
    setAddingToMealType(mealType);
    setShowIngredientSearch(true);
  }, []);

  // Pre-compute the combined meal lookup array used to match entries to meals
  // (avoids rebuilding this in multiple places during render)
  const allMealsLookup: MealToLog[] = useMemo(
    () => [
      ...available.from_todays_plan,
      ...available.from_week_plan,
      ...available.custom_meals,
      ...available.quick_cook_meals,
      ...(available.latest_plan_meals || []),
    ],
    [available.from_todays_plan, available.from_week_plan, available.custom_meals, available.quick_cook_meals, available.latest_plan_meals]
  );

  // Handle removing an entry from a meal section (stable reference for React.memo)
  const handleRemoveEntry = useCallback((entryId: string) => {
    const entry = summary.entries.find((e) => e.id === entryId);
    if (entry) {
      const meal = allMealsLookup.find((m) => m.logged_entry_id === entryId);
      if (meal) {
        handleUndoLog(entryId, meal);
      } else {
        handleUndoLog(entryId, {
          id: entryId,
          source: entry.entry_type,
          source_id: entryId,
          name: entry.display_name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          is_logged: true,
          logged_entry_id: entryId,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.entries, allMealsLookup]);

  // Recalculate percentages when summary changes
  const percentages: Macros = useMemo(() => ({
    calories:
      summary.targets.calories > 0 ? Math.round((summary.consumed.calories / summary.targets.calories) * 100) : 0,
    protein: summary.targets.protein > 0 ? Math.round((summary.consumed.protein / summary.targets.protein) * 100) : 0,
    carbs: summary.targets.carbs > 0 ? Math.round((summary.consumed.carbs / summary.targets.carbs) * 100) : 0,
    fat: summary.targets.fat > 0 ? Math.round((summary.consumed.fat / summary.targets.fat) * 100) : 0,
  }), [summary.targets, summary.consumed]);

  // Trigger confetti when hitting calorie goal
  useEffect(() => {
    // Skip confetti check while loading/fetching - we might be seeing stale/fallback data
    // that doesn't match the selected date, which could cause false confetti triggers
    if (loading) return;

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
  }, [percentages.calories, loading]);

  // Reset confetti flag when date changes
  useEffect(() => {
    hasShownConfettiRef.current = false;
    prevCaloriePercentageRef.current = null;
    hasShownFruitVegConfettiRef.current = false;
    prevFruitVegPercentageRef.current = null;
    hasShownWaterConfettiRef.current = false;
    prevWaterPercentageRef.current = null;
  }, [selectedDate]);

  // Trigger confetti when hitting 800g fruit/veg goal
  useEffect(() => {
    // Skip confetti check while loading/fetching - we might be seeing stale/fallback data
    if (loading) return;
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
  }, [summary.fruitVeg, selectedDate, loading]);

  // Trigger confetti when hitting 100oz water goal
  useEffect(() => {
    // Skip confetti check while loading/fetching - we might be seeing stale/fallback data
    if (loading) return;
    if (!summary.water) return;

    const currentPercentage = summary.water.percentage;
    const prevPercentage = prevWaterPercentageRef.current;

    // Only trigger if:
    // 1. We have a previous value (not initial load)
    // 2. We crossed the 100% threshold (was below, now at or above)
    // 3. We haven't already shown confetti for this date
    // 4. Server hasn't marked it as already celebrated
    if (
      prevPercentage !== null &&
      prevPercentage < 100 &&
      currentPercentage >= 100 &&
      !hasShownWaterConfettiRef.current &&
      !summary.water.goalCelebrated
    ) {
      hasShownWaterConfettiRef.current = true;

      // Fire confetti with blue colors from both sides
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],  // Blue palette
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // Mark as celebrated on the server
      fetch('/api/consumption/celebrate-water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      }).catch(console.error);
    }

    prevWaterPercentageRef.current = currentPercentage;
  }, [summary.water, selectedDate, loading]);

  // Get time-based suggested meals from today's plan
  const suggestedMeals = useMemo(
    () => available.from_todays_plan
      .filter((m) => m.meal_type && suggestedMealTypes.includes(m.meal_type) && !m.is_logged)
      .slice(0, 3),
    [available.from_todays_plan, suggestedMealTypes]
  );

  // Combine custom meals and quick cook for "My Meals" section
  // Meal plan meals are shown separately in the MealPlanMealsSection with search functionality
  const myMeals: MealToLog[] = useMemo(
    () => [...available.custom_meals, ...available.quick_cook_meals],
    [available.custom_meals, available.quick_cook_meals]
  );

  // latest_plan_meals contains meals from the most recent meal plan only
  // Search functionality in MealPlanMealsSection allows finding meals from older plans
  const latestPlanMeals = useMemo(
    () => available.latest_plan_meals || [],
    [available.latest_plan_meals]
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Log What I Ate</h1>
          {selectedPeriod !== 'summary' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="input-field w-auto"
            />
          )}
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
        {(selectedPeriod === 'weekly' || selectedPeriod === 'monthly') && periodSummary && (
          <>
            <PeriodProgressCard summary={periodSummary} />
            <div className="mt-4">
              <DailyAverageCard
                averagePerDay={periodSummary.averagePerDay}
                dailyTargets={summary.targets}
                daysWithData={periodSummary.daysWithData}
              />
            </div>
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
                dailyData={periodSummary.dailyData}
              />
            </div>
          </>
        )}

        {/* Summary View */}
        {selectedPeriod === 'summary' && summaryQuery.data && (
          <SummaryView data={summaryQuery.data} />
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
              water={summary.water}
              onAddWater={(ounces) => addWaterMutation.mutate({ date: selectedDate, ounces })}
              isAddingWater={addWaterMutation.isPending}
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
                  collapsible
                  initialCollapsed
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

            {/* Meal Type Sections */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setIsTodaysMealsCollapsed(!isTodaysMealsCollapsed)}
                className="flex items-center justify-between w-full text-left mb-3 cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-green-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  Today&apos;s Meals
                  <span className="text-sm font-normal text-gray-500">
                    ({summary.entry_count} items)
                  </span>
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isTodaysMealsCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Render sections for each meal type based on user's selected types */}
              {!isTodaysMealsCollapsed && (
              <>
              {orderedMealTypes.map((mealType) => {
                const entriesForType = summary.entries.filter((e) => e.meal_type === mealType);
                const prevEntriesInfo = previousEntries[mealType];

                return (
                  <MealSection
                    key={mealType}
                    mealType={mealType}
                    entries={entriesForType}
                    previousEntries={prevEntriesInfo}
                    initialCollapsed={entriesForType.length === 0}
                    forceExpand={recentlyLoggedToMealType === mealType}
                    onForceExpandHandled={() => setRecentlyLoggedToMealType(null)}
                    onAddEntry={handleAddFromSection}
                    onRemoveEntry={handleRemoveEntry}
                    onMoveEntry={handleMoveMealType}
                    onEditAmount={handleEditEntryAmount}
                    onRepeatFromPrevious={handleRepeatMealType}
                  />
                );
              })}

              {/* Unassigned entries (legacy data without meal_type) */}
              {(() => {
                const unassignedEntries = summary.entries.filter((e) => !e.meal_type);
                if (unassignedEntries.length === 0) return null;

                return (
                  <div className="card mb-4">
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
                              {orderedMealTypes.map((mt) => (
                                <option key={mt} value={mt}>
                                  {MEAL_TYPE_LABELS[mt]}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const meal = allMealsLookup.find((m) => m.logged_entry_id === entry.id);
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
              </>
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
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Log &ldquo;{pendingLogMeal.name}&rdquo;
              </h3>

              {/* Macro summary - shows edited or original macros */}
              {(() => {
                const displayMacros = editedIngredients
                  ? calculateTotalMacros(editedIngredients)
                  : { calories: pendingLogMeal.calories, protein: pendingLogMeal.protein, carbs: pendingLogMeal.carbs, fat: pendingLogMeal.fat };
                const isModified = editedIngredients && (
                  displayMacros.calories !== pendingLogMeal.calories ||
                  displayMacros.protein !== pendingLogMeal.protein ||
                  displayMacros.carbs !== pendingLogMeal.carbs ||
                  displayMacros.fat !== pendingLogMeal.fat
                );
                return (
                  <div className={`text-sm mb-4 p-2 rounded ${isModified ? 'bg-amber-50 border border-amber-200' : 'text-gray-500'}`}>
                    {isModified && <span className="text-amber-600 font-medium">Modified: </span>}
                    {Math.round(displayMacros.calories)} cal | {Math.round(displayMacros.protein * 10) / 10}g P | {Math.round(displayMacros.carbs * 10) / 10}g C | {Math.round(displayMacros.fat * 10) / 10}g F
                  </div>
                );
              })()}

              {/* Adjust portions toggle - only for meal_plan meals with meal_id */}
              {pendingLogMeal.source === 'meal_plan' && 'meal_id' in pendingLogMeal && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (showIngredientEditor) {
                        // Collapse and reset
                        setShowIngredientEditor(false);
                        setEditedIngredients(null);
                      } else {
                        // Expand
                        setShowIngredientEditor(true);
                        // Initialize editable ingredients when meal data is available
                        if (mealWithIngredients?.ingredients) {
                          setEditedIngredients(ingredientsToEditable(mealWithIngredients.ingredients));
                        }
                      }
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showIngredientEditor ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {showIngredientEditor ? 'Hide ingredients' : 'Adjust portions'}
                  </button>

                  {/* Ingredient editor section */}
                  {showIngredientEditor && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      {ingredientsLoading ? (
                        <div className="text-center py-4 text-gray-500">
                          <svg className="animate-spin h-5 w-5 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Loading ingredients...
                        </div>
                      ) : editedIngredients && editedIngredients.length > 0 ? (
                        <MealIngredientEditor
                          ingredients={editedIngredients}
                          onChange={setEditedIngredients}
                        />
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-2">
                          No ingredients available for this meal.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Inline Produce Tracking for 800g Goal */}
              {(pendingLogMeal.source === 'meal_plan' || pendingLogMeal.source === 'custom_meal' || pendingLogMeal.source === 'quick_cook') && (
                <div className="mb-4">
                  {isLoadingProduce ? (
                    <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm text-green-700">Detecting fruits & veggies...</span>
                    </div>
                  ) : detectedProduce.length > 0 ? (
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🥬</span>
                        <span className="font-medium text-green-800 text-sm">Add to 800g Goal</span>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                          +{detectedProduce.filter(p => p.isSelected).reduce((sum, p) => sum + p.adjustedGrams, 0)}g
                        </span>
                      </div>
                      <div className="space-y-2">
                        {detectedProduce.map((item, index) => (
                          <div
                            key={`${item.name}-${index}`}
                            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                              item.isSelected
                                ? 'bg-white border border-green-200'
                                : 'bg-green-50/50 opacity-60'
                            }`}
                          >
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => {
                                setDetectedProduce(prev =>
                                  prev.map((p, i) =>
                                    i === index ? { ...p, isSelected: !p.isSelected } : p
                                  )
                                );
                              }}
                              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                item.isSelected
                                  ? 'bg-green-600 border-green-600 text-white'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {item.isSelected && (
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            {/* Name */}
                            <div className="flex-1 min-w-0 flex items-center gap-1">
                              <span className="text-sm">{item.category === 'fruit' ? '🍎' : '🥬'}</span>
                              <span className={`text-sm truncate ${item.isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                {item.name}
                              </span>
                            </div>

                            {/* Gram adjuster */}
                            {item.isSelected && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetectedProduce(prev =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, adjustedGrams: Math.max(0, p.adjustedGrams - 25) } : p
                                      )
                                    );
                                  }}
                                  className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={item.adjustedGrams}
                                  onChange={(e) => {
                                    const newGrams = parseInt(e.target.value) || 0;
                                    setDetectedProduce(prev =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, adjustedGrams: Math.max(0, newGrams) } : p
                                      )
                                    );
                                  }}
                                  className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs font-semibold"
                                />
                                <span className="text-xs text-gray-500">g</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetectedProduce(prev =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, adjustedGrams: p.adjustedGrams + 25 } : p
                                      )
                                    );
                                  }}
                                  className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log as:
                </label>
                <MealTypeSelector
                  value={pendingMealType}
                  onChange={setPendingMealType}
                  suggestedTypes={suggestedMealTypes}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPendingLogMeal(null);
                    setPendingMealType(null);
                    setShowIngredientEditor(false);
                    setEditedIngredients(null);
                    setDetectedProduce([]);
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
            key={`${selectedIngredient.name}-${addingToMealType || 'default'}`}
            ingredient={selectedIngredient}
            isOpen={!!selectedIngredient}
            onClose={() => {
              setSelectedIngredient(null);
              setAddingToMealType(null);
            }}
            onLog={handleLogIngredient}
            initialMealType={addingToMealType}
          />
        )}

        {/* Add Ingredient Modal (for manual entry or barcode) */}
        <AddIngredientModal
          isOpen={showIngredientSearch || showBarcodeModal}
          onClose={() => {
            setShowIngredientSearch(false);
            setShowBarcodeModal(false);
            setAddingToMealType(null);
          }}
          onSelectIngredient={(ing) => {
            setShowIngredientSearch(false);
            setShowBarcodeModal(false);
            // Note: Do NOT clear addingToMealType here - it's used by IngredientAmountPicker
            // to set the default meal type when adding from a section
            setSelectedIngredient(ing);
          }}
        />

        {/* Meal Photo Modal */}
        <MealPhotoModal
          isOpen={showMealPhotoModal}
          onClose={() => setShowMealPhotoModal(false)}
          selectedDate={selectedDate}
          onMealLogged={(entry) => {
            // Optimistically add the new entry to cache
            optimisticallyAddEntry(queryClient, selectedDate, entry);
            // Auto-expand the meal section that was just logged to
            if (entry.meal_type) {
              setRecentlyLoggedToMealType(entry.meal_type);
              // Also expand the "Today's Meals" section if collapsed
              setIsTodaysMealsCollapsed(false);
            }
            // Invalidate to get accurate totals from server
            queryClient.invalidateQueries({ queryKey: queryKeys.consumption.all });
          }}
        />

      </main>

      <MobileTabBar />
    </div>
  );
}
