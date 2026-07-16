'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { MealType, MealPhotoAnalysisResult, IngredientToLog } from '@/lib/types';
import { MacroInput } from '@/components/ui';
import PaywallModal from '@/components/PaywallModal';
import AddIngredientModal from './AddIngredientModal';
import { useSubscription } from '@/hooks/useSubscription';

interface MealAnalysisReviewProps {
  photoId: string;
  imageUrl: string;
  initialContext?: string;
  onSave: (data: SaveMealData) => void;
  onRetry: () => void;
  onCancel: () => void;
}

interface SaveMealData {
  mealName: string;
  mealType: MealType;
  ingredients: EditableIngredient[];
  totalMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  saveTo: 'consumption' | 'library' | 'both';
  notes: string;
}

type IngredientCategory = 'protein' | 'vegetable' | 'fruit' | 'grain' | 'fat' | 'dairy' | 'other';

interface EditableIngredient {
  name: string;
  estimated_amount: string;
  estimated_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  category?: IngredientCategory;
}

interface AnalysisResponse {
  photoId: string;
  imageUrl: string;
  status: string;
  analysis: MealPhotoAnalysisResult;
  mealName: string;
  mealDescription?: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confidenceScore: number;
  analysisNotes?: string;
  ingredients: Array<{
    id: string;
    name: string;
    estimated_amount: string;
    estimated_unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence_score: number;
    category?: IngredientCategory;
  }>;
}

const EDITABLE_CATEGORIES: readonly string[] = ['protein', 'vegetable', 'fruit', 'grain', 'fat', 'dairy', 'other'];

function toEditableCategory(category?: string): IngredientCategory | undefined {
  if (!category) return undefined;
  return EDITABLE_CATEGORIES.includes(category) ? (category as IngredientCategory) : 'other';
}

export default function MealAnalysisReview({
  photoId,
  imageUrl,
  initialContext,
  onSave,
  onRetry,
  onCancel,
}: MealAnalysisReviewProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);

  // Editable form state
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);
  const [saveTo, setSaveTo] = useState<'consumption' | 'library' | 'both'>('consumption');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [reanalyzeContext, setReanalyzeContext] = useState(initialContext || '');
  const { refresh: refreshSubscription } = useSubscription();

  const rootRef = useRef<HTMLDivElement>(null);

  // Calculate totals from ingredients
  const totalMacros = useMemo(() => {
    return ingredients.reduce(
      (totals, ing) => ({
        calories: totals.calories + ing.calories,
        protein: totals.protein + ing.protein,
        carbs: totals.carbs + ing.carbs,
        fat: totals.fat + ing.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [ingredients]);

  // Run analysis on mount
  useEffect(() => {
    analyzePhoto(initialContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId]);

  // Web fallback: when the visual viewport shrinks (keyboard opens), keep the
  // focused input visible. Native keyboard handling lives in MealPhotoModal.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
        setTimeout(() => {
          active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  const handleInputFocus = (e: React.FocusEvent<HTMLElement>) => {
    const target = e.currentTarget;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const analyzePhoto = async (context?: string, force = false) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`/api/meal-photos/${photoId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: context?.trim() || undefined,
          force,
        }),
      });

      if (response.status === 402) {
        setShowPaywall(true);
        setIsAnalyzing(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data: AnalysisResponse = await response.json();
      setAnalysisData(data);

      // Initialize editable state from analysis
      setMealName(data.mealName || 'Meal from Photo');
      setIngredients(
        data.ingredients.map((ing) => ({
          name: ing.name,
          estimated_amount: ing.estimated_amount,
          estimated_unit: ing.estimated_unit,
          calories: ing.calories,
          protein: ing.protein,
          carbs: ing.carbs,
          fat: ing.fat,
          confidence: ing.confidence_score,
          category: ing.category,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReanalyze = () => {
    analyzePhoto(reanalyzeContext, true);
  };

  const handleIngredientChange = (index: number, field: keyof EditableIngredient, value: string | number) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSelectIngredient = (ingredient: IngredientToLog) => {
    setIngredients((prev) => [
      ...prev,
      {
        name: ingredient.name,
        estimated_amount: String(ingredient.default_amount),
        estimated_unit: ingredient.default_unit,
        calories: ingredient.calories_per_serving,
        protein: ingredient.protein_per_serving,
        carbs: ingredient.carbs_per_serving,
        fat: ingredient.fat_per_serving,
        confidence: 1,
        category: toEditableCategory(ingredient.category),
      },
    ]);
    setShowAddIngredient(false);
  };

  const handleSave = async () => {
    if (!mealName.trim() || ingredients.length === 0) {
      return;
    }

    setIsSaving(true);

    try {
      onSave({
        mealName,
        mealType,
        ingredients,
        totalMacros: {
          calories: Math.round(totalMacros.calories),
          protein: Math.round(totalMacros.protein * 10) / 10,
          carbs: Math.round(totalMacros.carbs * 10) / 10,
          fat: Math.round(totalMacros.fat * 10) / 10,
        },
        saveTo,
        notes,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    onRetry();
  };

  // Analyzing state
  if (isAnalyzing) {
    return (
      <div className="p-6 text-center">
        <div className="mb-4">
          <img src={imageUrl} alt="Meal" className="w-32 h-32 object-cover rounded-lg mx-auto opacity-75" />
        </div>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing your meal...</h3>
        <p className="text-sm text-gray-600">This can take up to a minute for complex meals</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis Failed</h3>
        <p className="text-gray-600 mb-4 text-sm">{error}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={handleRetry} className="btn-primary text-sm px-4 py-2">
            Try Again
          </button>
          <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Review state
  return (
    <div ref={rootRef} className="space-y-4">
      {/* Photo and confidence */}
      <div className="flex gap-4 items-center">
        <img src={imageUrl} alt="Meal" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
        {analysisData?.confidenceScore !== undefined && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              analysisData.confidenceScore >= 0.8
                ? 'bg-green-100 text-green-700'
                : analysisData.confidenceScore >= 0.6
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {Math.round(analysisData.confidenceScore * 100)}% confidence
          </span>
        )}
      </div>

      {/* Meal name - full-width row so it's easy to see and edit on mobile */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Meal Name</label>
        <input
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          onFocus={handleInputFocus}
          className="input-field w-full text-base font-medium py-3"
          placeholder="Meal name"
        />
      </div>

      {/* Meal type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
        <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className="input-field">
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      {/* Macro totals */}
      <div className="bg-primary-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Total Macros</h4>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-xl font-bold text-primary-600">{Math.round(totalMacros.calories)}</div>
            <div className="text-xs text-gray-600">Calories</div>
          </div>
          <div>
            <div className="text-xl font-bold text-primary-600">{Math.round(totalMacros.protein)}g</div>
            <div className="text-xs text-gray-600">Protein</div>
          </div>
          <div>
            <div className="text-xl font-bold text-primary-600">{Math.round(totalMacros.carbs)}g</div>
            <div className="text-xs text-gray-600">Carbs</div>
          </div>
          <div>
            <div className="text-xl font-bold text-primary-600">{Math.round(totalMacros.fat)}g</div>
            <div className="text-xs text-gray-600">Fat</div>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Ingredients</h4>
        <div className="space-y-2">
          {ingredients.map((ing, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                  onFocus={handleInputFocus}
                  className="flex-1 input-field text-sm py-1"
                  placeholder="Ingredient"
                />
                <input
                  type="text"
                  value={ing.estimated_amount}
                  onChange={(e) => handleIngredientChange(index, 'estimated_amount', e.target.value)}
                  onFocus={handleInputFocus}
                  className="w-16 input-field text-sm py-1 text-center"
                  placeholder="Amt"
                />
                <input
                  type="text"
                  value={ing.estimated_unit}
                  onChange={(e) => handleIngredientChange(index, 'estimated_unit', e.target.value)}
                  onFocus={handleInputFocus}
                  className="w-16 input-field text-sm py-1"
                  placeholder="Unit"
                />
                <button
                  onClick={() => handleRemoveIngredient(index)}
                  className="text-red-500 hover:text-red-700 px-2"
                  aria-label="Remove ingredient"
                >
                  &times;
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <MacroInput
                  macroType="calories"
                  value={ing.calories}
                  onChange={(val) => handleIngredientChange(index, 'calories', val)}
                  size="sm"
                />
                <MacroInput
                  macroType="protein"
                  value={ing.protein}
                  onChange={(val) => handleIngredientChange(index, 'protein', val)}
                  size="sm"
                />
                <MacroInput
                  macroType="carbs"
                  value={ing.carbs}
                  onChange={(val) => handleIngredientChange(index, 'carbs', val)}
                  size="sm"
                />
                <MacroInput
                  macroType="fat"
                  value={ing.fat}
                  onChange={(val) => handleIngredientChange(index, 'fat', val)}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add ingredient from the FuelRx database */}
        <button
          onClick={() => setShowAddIngredient(true)}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-primary-300 text-primary-600 hover:bg-primary-50 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Ingredient
        </button>
      </div>

      {/* Re-analyze with a description */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-2">AI missed something?</p>
        <textarea
          value={reanalyzeContext}
          onChange={(e) => setReanalyzeContext(e.target.value)}
          onFocus={handleInputFocus}
          className="input-field text-sm overflow-y-auto"
          style={{ maxHeight: '96px' }}
          rows={2}
          maxLength={500}
          placeholder="Describe the meal (e.g., beef barbacoa bowl with cauliflower rice)..."
        />
        <button
          onClick={handleReanalyze}
          disabled={!reanalyzeContext.trim()}
          className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-800 disabled:opacity-50"
        >
          Re-analyze photo
        </button>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={handleInputFocus}
          className="input-field text-sm"
          rows={2}
          placeholder="Any notes about this meal..."
        />
      </div>

      {/* Save options */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Save Options</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="saveTo"
              value="consumption"
              checked={saveTo === 'consumption'}
              onChange={() => setSaveTo('consumption')}
              className="text-primary-600"
            />
            <span className="text-sm text-gray-700">Log to today&apos;s consumption only</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="saveTo"
              value="both"
              checked={saveTo === 'both'}
              onChange={() => setSaveTo('both')}
              className="text-primary-600"
            />
            <span className="text-sm text-gray-700">Log and save to My Meals library</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="saveTo"
              value="library"
              checked={saveTo === 'library'}
              onChange={() => setSaveTo('library')}
              className="text-primary-600"
            />
            <span className="text-sm text-gray-700">Save to My Meals library only</span>
          </label>
        </div>
      </div>

      {/* Analysis notes */}
      {analysisData?.analysisNotes && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>AI Notes:</strong> {analysisData.analysisNotes}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-white pt-2 border-t">
        <button onClick={onCancel} className="btn-secondary flex-1" disabled={isSaving}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!mealName.trim() || ingredients.length === 0 || isSaving}
          className="btn-primary flex-1"
        >
          {isSaving ? 'Saving...' : saveTo === 'both' ? 'Log & Save' : saveTo === 'consumption' ? 'Log Meal' : 'Save Meal'}
        </button>
      </div>

      {/* Add ingredient modal (searches the FuelRx ingredient database) */}
      <AddIngredientModal
        isOpen={showAddIngredient}
        onClose={() => setShowAddIngredient(false)}
        onSelectIngredient={handleSelectIngredient}
      />

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          refreshSubscription();
          onCancel();
        }}
      />
    </div>
  );
}
