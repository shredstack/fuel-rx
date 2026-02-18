'use client';

import { useState, useEffect } from 'react';
import type { MealSlot, MealType } from '@/lib/types';
import { useLogMeal } from '@/hooks/queries/useConsumptionMutations';
import LogMealConfirmationModal, {
  type DetectedProduceItem,
  type LogMealConfirmData,
} from '@/components/consumption/LogMealConfirmationModal';

interface LogMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealSlot: MealSlot;
  mealPlanMealId: string;
  defaultMealType?: MealType;
  onLogSuccess?: () => void;
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

export function LogMealModal({
  isOpen,
  onClose,
  mealSlot,
  mealPlanMealId,
  defaultMealType,
  onLogSuccess,
}: LogMealModalProps) {
  const meal = mealSlot.meal;
  const logMealMutation = useLogMeal();

  // Meal type selection
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    defaultMealType || mealSlot.meal_type || getTimeBasedMealTypes()[0]
  );

  // Produce tracking state for 800g goal
  const [detectedProduce, setDetectedProduce] = useState<DetectedProduceItem[]>([]);
  const [isLoadingProduce, setIsLoadingProduce] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMealType(defaultMealType || mealSlot.meal_type || getTimeBasedMealTypes()[0]);
      setDetectedProduce([]);

      // Fetch produce data for 800g tracking
      const fetchProduce = async () => {
        setIsLoadingProduce(true);
        try {
          const response = await fetch('/api/consumption/extract-produce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meal_id: meal.id }),
          });

          if (response.ok) {
            const data = await response.json();
            const items = data.produceIngredients || [];

            // Initialize produce items with selection state
            const initializedItems: DetectedProduceItem[] = items.map(
              (item: {
                name: string;
                amount: string;
                unit: string;
                category: 'fruit' | 'vegetable';
                estimatedGrams: number;
              }) => ({
                ...item,
                isSelected: true,
                adjustedGrams: item.estimatedGrams,
              })
            );

            setDetectedProduce(initializedItems);
          }
        } catch (error) {
          console.error('Error fetching produce:', error);
        } finally {
          setIsLoadingProduce(false);
        }
      };

      fetchProduce();
    }
  }, [isOpen, meal.id, defaultMealType, mealSlot.meal_type]);

  const handleConfirm = async (data: LogMealConfirmData) => {
    const today = getLocalTodayString();

    try {
      // Build request payload
      const payload: {
        type: 'meal_plan';
        source_id: string;
        meal_id: string;
        meal_type: MealType;
        consumed_at: string;
        custom_macros?: { calories: number; protein: number; carbs: number; fat: number };
      } = {
        type: 'meal_plan',
        source_id: mealPlanMealId,
        meal_id: meal.id,
        meal_type: data.mealType,
        consumed_at: `${today}T${new Date().toTimeString().slice(0, 8)}`,
      };

      // Include custom macros if user modified portions
      if (data.customMacros) {
        payload.custom_macros = data.customMacros;
      }

      await logMealMutation.mutateAsync(payload);

      // Log selected produce items for 800g tracking
      if (data.selectedProduce.length > 0) {
        try {
          await fetch('/api/consumption/log-produce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ingredients: data.selectedProduce,
              meal_type: data.mealType,
              consumed_at: `${today}T${new Date().toTimeString().slice(0, 8)}`,
            }),
          });
        } catch (e) {
          // Silently fail - don't block the main logging flow
          console.error('Error logging produce:', e);
        }
      }

      onLogSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error logging meal:', error);
    }
  };

  return (
    <LogMealConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      mealName={meal.name}
      mealMacros={{
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      }}
      mealId={meal.id}
      mealType={selectedMealType}
      onMealTypeChange={setSelectedMealType}
      suggestedMealTypes={getTimeBasedMealTypes()}
      detectedProduce={detectedProduce}
      onProduceChange={setDetectedProduce}
      isLoadingProduce={isLoadingProduce}
      onConfirm={handleConfirm}
      isLogging={logMealMutation.isPending}
    />
  );
}
