'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import type {
  SavedMeal,
  SavedUserMeal,
  SavedQuickCookMeal,
  SavedPartyMeal,
  ValidatedMealIngredient,
  CustomMealPrepTime,
} from '@/lib/types'
import {
  CUSTOM_MEAL_PREP_TIME_OPTIONS,
  isSavedUserMeal,
  isSavedQuickCookMeal,
  isSavedPartyMeal,
} from '@/lib/types'
import { MacroInput } from '@/components/ui'
import { compressImage, isValidImageType, formatFileSize } from '@/lib/imageCompression'
import SavedSingleMealCard from '@/components/SavedSingleMealCard'
import SavedPartyMealCard from '@/components/SavedPartyMealCard'
import NutritionDisclaimer from '@/components/NutritionDisclaimer'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'

interface Props {
  initialMeals: SavedMeal[]
  socialFeedEnabled: boolean
}

type TabType = 'my-recipes' | 'quick-cook' | 'party-plans'

const VALID_TABS: TabType[] = ['my-recipes', 'quick-cook', 'party-plans']

interface IngredientInput {
  name: string
  amount: string
  calories: number
  protein: number
  carbs: number
  fat: number
  isExpanded: boolean
}

const emptyIngredient: IngredientInput = {
  name: '',
  amount: '',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  isExpanded: true,
}

export default function CustomMealsClient({ initialMeals, socialFeedEnabled }: Props) {
  const searchParams = useSearchParams()
  const [meals, setMeals] = useState<SavedMeal[]>(initialMeals)
  const [activeTab, setActiveTab] = useState<TabType>('my-recipes')
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Read tab from URL params on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType | null
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])
  const [mealName, setMealName] = useState('')
  const [ingredients, setIngredients] = useState<IngredientInput[]>([{ ...emptyIngredient }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Share with community checkbox - default to user's social_feed_enabled setting
  const [shareWithCommunity, setShareWithCommunity] = useState(socialFeedEnabled)

  // Quick Add mode - enter total macros directly without ingredients
  const [isQuickAddMode, setIsQuickAddMode] = useState(false)
  const [quickMacros, setQuickMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })

  // Prep time selection
  const [prepTime, setPrepTime] = useState<CustomMealPrepTime | null>(null)

  // Meal prep instructions - array of steps
  const [instructionSteps, setInstructionSteps] = useState<string[]>([''])

  // Edit mode state
  const [editingMealId, setEditingMealId] = useState<string | null>(null)

  // Image validation modal state
  const [showImageValidationModal, setShowImageValidationModal] = useState(false)
  const [imageValidationMessage, setImageValidationMessage] = useState<string | null>(null)

  // Filter meals by type based on active tab
  const userMeals = meals.filter(isSavedUserMeal)
  const quickCookMeals = meals.filter(isSavedQuickCookMeal)
  const partyMeals = meals.filter(isSavedPartyMeal)

  // Calculate totals from ingredients or use quick macros
  const ingredientTotals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.calories || 0),
      protein: acc.protein + (ing.protein || 0),
      carbs: acc.carbs + (ing.carbs || 0),
      fat: acc.fat + (ing.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const totals = isQuickAddMode ? quickMacros : ingredientTotals

  const toggleIngredientExpanded = (index: number) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], isExpanded: !updated[index].isExpanded }
    setIngredients(updated)
  }

  const addIngredient = () => {
    setIngredients([...ingredients, { ...emptyIngredient }])
  }

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index))
    }
  }

  const updateIngredient = (index: number, field: keyof IngredientInput, value: string | number) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], [field]: value }
    setIngredients(updated)
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImageError(null)
    setCompressionInfo(null)

    if (!isValidImageType(file)) {
      setImageError('Please select a JPEG, PNG, or WebP image')
      return
    }

    try {
      const originalSize = file.size
      const compressedBlob = await compressImage(file)
      const compressedSize = compressedBlob.size
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'image/jpeg',
      })

      setImageFile(compressedFile)
      setCompressionInfo(
        `Compressed: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${Math.round((1 - compressedSize / originalSize) * 100)}% smaller)`
      )
      const previewUrl = URL.createObjectURL(compressedBlob)
      setImagePreview(previewUrl)
    } catch {
      setImageError('Failed to process image. Please try another file.')
    }
  }

  const removeImage = () => {
    setImageFile(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(null)
    setCompressionInfo(null)
    setImageError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const addInstructionStep = () => {
    setInstructionSteps([...instructionSteps, ''])
  }

  const removeInstructionStep = (index: number) => {
    if (instructionSteps.length > 1) {
      setInstructionSteps(instructionSteps.filter((_, i) => i !== index))
    }
  }

  const updateInstructionStep = (index: number, value: string) => {
    const updated = [...instructionSteps]
    updated[index] = value
    setInstructionSteps(updated)
  }

  const resetForm = () => {
    setMealName('')
    setIngredients([{ ...emptyIngredient }])
    removeImage()
    setShareWithCommunity(socialFeedEnabled) // Reset to user's default
    setIsQuickAddMode(false)
    setQuickMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 })
    setPrepTime(null)
    setInstructionSteps([''])
    setEditingMealId(null)
    setShowCreateForm(false)
    setError(null)
  }

  const startEditMeal = (meal: SavedUserMeal) => {
    setEditingMealId(meal.id)
    setMealName(meal.name)
    // Convert prep_time_minutes to CustomMealPrepTime
    const minutes = meal.prep_time_minutes
    let prepTimeValue: CustomMealPrepTime | null = null
    if (minutes <= 5) prepTimeValue = '5_or_less'
    else if (minutes <= 15) prepTimeValue = '15'
    else if (minutes <= 30) prepTimeValue = '30'
    else prepTimeValue = 'more_than_30'
    setPrepTime(prepTimeValue)

    // Parse existing instructions into steps
    if (meal.instructions && meal.instructions.length > 0) {
      setInstructionSteps(meal.instructions)
    } else if (meal.prep_instructions) {
      const steps = meal.prep_instructions
        .split('\n')
        .map(s => s.replace(/^\d+\.\s*/, '').trim())
        .filter(s => s.length > 0)
      setInstructionSteps(steps.length > 0 ? steps : [''])
    } else {
      setInstructionSteps([''])
    }
    setShareWithCommunity(meal.is_public)

    if (meal.image_url) {
      setImagePreview(meal.image_url)
    } else {
      setImagePreview(null)
    }
    setImageFile(null)
    setCompressionInfo(null)

    // Check if this was a quick add meal (single ingredient with same name as meal)
    const isQuickAdd = meal.ingredients &&
      meal.ingredients.length === 1 &&
      (meal.ingredients as ValidatedMealIngredient[])[0].name === meal.name

    if (isQuickAdd) {
      setIsQuickAddMode(true)
      setQuickMacros({
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      })
      setIngredients([{ ...emptyIngredient }])
    } else {
      setIsQuickAddMode(false)
      setQuickMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 })
      if (meal.ingredients && (meal.ingredients as ValidatedMealIngredient[]).length > 0) {
        const ingredientInputs: IngredientInput[] = (meal.ingredients as ValidatedMealIngredient[]).map((ing) => ({
          name: ing.name,
          amount: `${ing.amount}${ing.unit ? ' ' + ing.unit : ''}`.trim(),
          calories: ing.calories,
          protein: ing.protein,
          carbs: ing.carbs,
          fat: ing.fat,
          isExpanded: false,
        }))
        setIngredients(ingredientInputs)
      } else {
        setIngredients([{ ...emptyIngredient }])
      }
    }

    setShowCreateForm(true)
    setActiveTab('my-recipes')
  }

  const uploadImage = async (): Promise<{ success: boolean; url?: string; validationFailed?: boolean; message?: string }> => {
    if (!imageFile) return { success: true, url: undefined }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('image', imageFile)

      const response = await fetch('/api/upload-meal-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()

        // Check if this is a validation rejection
        if (data.code === 'NOT_FOOD' || data.code === 'INAPPROPRIATE_CONTENT') {
          return {
            success: false,
            validationFailed: true,
            message: data.error || 'Please upload an image of food.'
          }
        }

        throw new Error(data.error || 'Failed to upload image')
      }

      const { url } = await response.json()
      return { success: true, url }
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to upload image')
      return { success: false, validationFailed: false }
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async () => {
    setError(null)

    if (!mealName.trim()) {
      setError('Please enter a meal name')
      return
    }

    const validIngredients = ingredients.filter((ing) => ing.name.trim() !== '')
    if (!isQuickAddMode && validIngredients.length === 0) {
      setError('Please add at least one ingredient with a name')
      return
    }

    if (isQuickAddMode && quickMacros.calories === 0) {
      setError('Please enter at least the calorie amount')
      return
    }

    setSaving(true)

    try {
      let imageUrl: string | null = null
      if (imageFile) {
        const uploadResult = await uploadImage()

        if (!uploadResult.success) {
          if (uploadResult.validationFailed) {
            // Show modal to let user choose what to do
            setImageValidationMessage(uploadResult.message || 'This image could not be validated as food.')
            setShowImageValidationModal(true)
            setSaving(false)
            return
          }
          // Other upload error - already shown via imageError state
          setSaving(false)
          return
        }

        imageUrl = uploadResult.url || null
      } else if (editingMealId && imagePreview && !imagePreview.startsWith('blob:')) {
        imageUrl = imagePreview
      }

      const ingredientsToSave = isQuickAddMode
        ? [{
            name: mealName.trim(),
            amount: '1',
            unit: 'serving',
            calories: Number(quickMacros.calories) || 0,
            protein: Number(quickMacros.protein) || 0,
            carbs: Number(quickMacros.carbs) || 0,
            fat: Number(quickMacros.fat) || 0,
          }]
        : validIngredients.map((ing) => {
            const amountParts = ing.amount.trim().split(/\s+/)
            const amount = amountParts[0] || ''
            const unit = amountParts.slice(1).join(' ') || ''
            return {
              name: ing.name.trim(),
              amount,
              unit,
              calories: Number(ing.calories) || 0,
              protein: Number(ing.protein) || 0,
              carbs: Number(ing.carbs) || 0,
              fat: Number(ing.fat) || 0,
            }
          })

      const isEditing = !!editingMealId
      const response = await fetch('/api/custom-meals', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEditing && { id: editingMealId }),
          meal_name: mealName.trim(),
          ingredients: ingredientsToSave,
          image_url: imageUrl,
          share_with_community: shareWithCommunity,
          prep_time: prepTime,
          meal_prep_instructions: instructionSteps
            .filter(s => s.trim().length > 0)
            .map((step, i) => `${i + 1}. ${step.trim()}`)
            .join('\n') || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save meal')
      }

      const savedMeal = await response.json()

      // Convert API response to SavedUserMeal format
      const newSavedMeal: SavedUserMeal = {
        id: savedMeal.id,
        name: savedMeal.meal_name,
        source_type: 'user_created',
        source_user_id: savedMeal.user_id,
        is_public: savedMeal.share_with_community,
        image_url: savedMeal.image_url,
        created_at: savedMeal.created_at,
        updated_at: savedMeal.updated_at,
        source_community_post_id: null, // User-created meals don't come from community
        meal_type: null,
        calories: savedMeal.calories,
        protein: savedMeal.protein,
        carbs: savedMeal.carbs,
        fat: savedMeal.fat,
        ingredients: savedMeal.ingredients,
        instructions: instructionSteps.filter(s => s.trim().length > 0),
        prep_time_minutes: prepTime === '5_or_less' ? 5 : prepTime === '15' ? 15 : prepTime === '30' ? 30 : 45,
        prep_instructions: savedMeal.meal_prep_instructions,
      }

      if (isEditing) {
        setMeals(meals.map((m) => m.id === savedMeal.id ? newSavedMeal : m))
      } else {
        const existingIndex = meals.findIndex((m) => m.name === newSavedMeal.name)
        if (existingIndex >= 0) {
          const updated = [...meals]
          updated[existingIndex] = newSavedMeal
          setMeals(updated)
        } else {
          setMeals([newSavedMeal, ...meals])
        }
      }

      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveWithoutImage = async () => {
    // Close the modal and remove the problematic image
    setShowImageValidationModal(false)
    setImageValidationMessage(null)
    removeImage()

    // Now save without the image
    setSaving(true)

    try {
      const ingredientsToSave = isQuickAddMode
        ? [{
            name: mealName.trim(),
            amount: '1',
            unit: 'serving',
            calories: Number(quickMacros.calories) || 0,
            protein: Number(quickMacros.protein) || 0,
            carbs: Number(quickMacros.carbs) || 0,
            fat: Number(quickMacros.fat) || 0,
          }]
        : ingredients.filter((ing) => ing.name.trim() !== '').map((ing) => {
            const amountParts = ing.amount.trim().split(/\s+/)
            const amount = amountParts[0] || ''
            const unit = amountParts.slice(1).join(' ') || ''
            return {
              name: ing.name.trim(),
              amount,
              unit,
              calories: Number(ing.calories) || 0,
              protein: Number(ing.protein) || 0,
              carbs: Number(ing.carbs) || 0,
              fat: Number(ing.fat) || 0,
            }
          })

      // Keep existing image if editing, otherwise no image
      let imageUrl: string | null = null
      if (editingMealId && imagePreview && !imagePreview.startsWith('blob:')) {
        imageUrl = imagePreview
      }

      const isEditing = !!editingMealId
      const response = await fetch('/api/custom-meals', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEditing && { id: editingMealId }),
          meal_name: mealName.trim(),
          ingredients: ingredientsToSave,
          image_url: imageUrl,
          share_with_community: shareWithCommunity,
          prep_time: prepTime,
          meal_prep_instructions: instructionSteps
            .filter(s => s.trim().length > 0)
            .map((step, i) => `${i + 1}. ${step.trim()}`)
            .join('\n') || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save meal')
      }

      const savedMeal = await response.json()

      const newSavedMeal: SavedUserMeal = {
        id: savedMeal.id,
        name: savedMeal.meal_name,
        source_type: 'user_created',
        source_user_id: savedMeal.user_id,
        is_public: savedMeal.share_with_community,
        image_url: savedMeal.image_url,
        created_at: savedMeal.created_at,
        updated_at: savedMeal.updated_at,
        source_community_post_id: null,
        meal_type: null,
        calories: savedMeal.calories,
        protein: savedMeal.protein,
        carbs: savedMeal.carbs,
        fat: savedMeal.fat,
        ingredients: savedMeal.ingredients,
        instructions: instructionSteps.filter(s => s.trim().length > 0),
        prep_time_minutes: prepTime === '5_or_less' ? 5 : prepTime === '15' ? 15 : prepTime === '30' ? 30 : 45,
        prep_instructions: savedMeal.meal_prep_instructions,
      }

      if (isEditing) {
        setMeals(meals.map((m) => m.id === savedMeal.id ? newSavedMeal : m))
      } else {
        const existingIndex = meals.findIndex((m) => m.name === newSavedMeal.name)
        if (existingIndex >= 0) {
          const updated = [...meals]
          updated[existingIndex] = newSavedMeal
          setMeals(updated)
        } else {
          setMeals([newSavedMeal, ...meals])
        }
      }

      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal')
    } finally {
      setSaving(false)
    }
  }

  const handleTryDifferentImage = () => {
    // Close modal and let user pick a new image
    setShowImageValidationModal(false)
    setImageValidationMessage(null)
    removeImage()
    // Focus the file input
    fileInputRef.current?.click()
  }

  const handleDelete = async (mealId: string) => {
    try {
      const response = await fetch(`/api/custom-meals?id=${mealId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete meal')
      }

      setMeals(meals.filter((m) => m.id !== mealId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meal')
    }
  }

  const tabCounts = {
    'my-recipes': userMeals.length,
    'quick-cook': quickCookMeals.length,
    'party-plans': partyMeals.length,
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-primary-600 mb-6">My Meals</h1>
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
          <nav className="flex overflow-x-auto scrollbar-hide border-b border-gray-200 -mb-px">
            <button
              onClick={() => setActiveTab('my-recipes')}
              className={`flex-1 min-w-0 py-3 px-3 sm:px-6 text-center font-medium transition-colors relative whitespace-nowrap ${
                activeTab === 'my-recipes'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1 sm:gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-sm sm:text-base">Recipes</span>
                {tabCounts['my-recipes'] > 0 && (
                  <span className="bg-gray-100 text-gray-600 px-1.5 sm:px-2 py-0.5 rounded-full text-xs flex-shrink-0">
                    {tabCounts['my-recipes']}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('quick-cook')}
              className={`flex-1 min-w-0 py-3 px-3 sm:px-6 text-center font-medium transition-colors relative whitespace-nowrap ${
                activeTab === 'quick-cook'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1 sm:gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm sm:text-base">Quick Cook</span>
                {tabCounts['quick-cook'] > 0 && (
                  <span className="bg-gray-100 text-gray-600 px-1.5 sm:px-2 py-0.5 rounded-full text-xs flex-shrink-0">
                    {tabCounts['quick-cook']}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('party-plans')}
              className={`flex-1 min-w-0 py-3 px-3 sm:px-6 text-center font-medium transition-colors relative whitespace-nowrap ${
                activeTab === 'party-plans'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1 sm:gap-2">
                <span className="text-base sm:text-lg flex-shrink-0">🎉</span>
                <span className="text-sm sm:text-base">Party</span>
                {tabCounts['party-plans'] > 0 && (
                  <span className="bg-gray-100 text-gray-600 px-1.5 sm:px-2 py-0.5 rounded-full text-xs flex-shrink-0">
                    {tabCounts['party-plans']}
                  </span>
                )}
              </span>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'my-recipes' && (
          <div>
            {/* Create new meal button or form */}
            {!showCreateForm ? (
              <button onClick={() => setShowCreateForm(true)} className="btn-primary mb-6">
                + Create New Recipe
              </button>
            ) : (
              <div className="card mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {editingMealId ? 'Edit Recipe' : 'Create New Recipe'}
                </h2>

                {/* Meal Name */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name *</label>
                  <input
                    type="text"
                    value={mealName}
                    onChange={(e) => setMealName(e.target.value)}
                    placeholder="e.g., Protein Oatmeal Bowl"
                    className="input text-lg"
                  />
                </div>

                {/* Mode Toggle */}
                <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
                  <button
                    type="button"
                    onClick={() => setIsQuickAddMode(false)}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      !isQuickAddMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    With Ingredients
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddMode(true)}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      isQuickAddMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Quick Add (Totals Only)
                  </button>
                </div>

                {isQuickAddMode ? (
                  /* Quick Add Mode - Just enter total macros */
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                      Enter the total macros for your meal. Perfect for meals where you already know the totals.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-orange-50 rounded-lg p-4">
                        <MacroInput
                          macroType="calories"
                          value={quickMacros.calories}
                          onChange={(val) => setQuickMacros({ ...quickMacros, calories: val })}
                          label="Calories *"
                          size="lg"
                        />
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <MacroInput
                          macroType="protein"
                          value={quickMacros.protein}
                          onChange={(val) => setQuickMacros({ ...quickMacros, protein: val })}
                          label="Protein (g)"
                          size="lg"
                        />
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4">
                        <MacroInput
                          macroType="carbs"
                          value={quickMacros.carbs}
                          onChange={(val) => setQuickMacros({ ...quickMacros, carbs: val })}
                          label="Carbs (g)"
                          size="lg"
                        />
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <MacroInput
                          macroType="fat"
                          value={quickMacros.fat}
                          onChange={(val) => setQuickMacros({ ...quickMacros, fat: val })}
                          label="Fat (g)"
                          size="lg"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Detailed Ingredients Mode */
                  <>
                    <p className="text-sm text-gray-500 mb-4">
                      Add each ingredient with its macros. The total will be calculated automatically.
                    </p>

                    <div className="space-y-3">
                      {ingredients.map((ingredient, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div
                            className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                              ingredient.isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => toggleIngredientExpanded(index)}
                          >
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                                ingredient.isExpanded ? 'rotate-90' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              {ingredient.name ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 truncate">
                                    {ingredient.amount && `${ingredient.amount} `}{ingredient.name}
                                  </span>
                                  {(ingredient.calories > 0) && (
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                      {ingredient.calories} cal
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">Ingredient {index + 1}</span>
                              )}
                            </div>
                            {ingredients.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeIngredient(index)
                                }}
                                className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {ingredient.isExpanded && (
                            <div className="p-4 pt-2 space-y-4 border-t border-gray-100">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Ingredient Name *</label>
                                  <input
                                    type="text"
                                    value={ingredient.name}
                                    onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                                    placeholder="e.g., Rolled oats"
                                    className="input"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Amount (e.g., &quot;1 cup&quot;)</label>
                                  <input
                                    type="text"
                                    value={ingredient.amount}
                                    onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                                    placeholder="e.g., 1 cup, 100g"
                                    className="input"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-orange-50 rounded-lg p-3">
                                  <MacroInput
                                    macroType="calories"
                                    value={ingredient.calories}
                                    onChange={(val) => updateIngredient(index, 'calories', val)}
                                    label="Calories"
                                    size="sm"
                                  />
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3">
                                  <MacroInput
                                    macroType="protein"
                                    value={ingredient.protein}
                                    onChange={(val) => updateIngredient(index, 'protein', val)}
                                    label="Protein"
                                    size="sm"
                                  />
                                </div>
                                <div className="bg-amber-50 rounded-lg p-3">
                                  <MacroInput
                                    macroType="carbs"
                                    value={ingredient.carbs}
                                    onChange={(val) => updateIngredient(index, 'carbs', val)}
                                    label="Carbs"
                                    size="sm"
                                  />
                                </div>
                                <div className="bg-purple-50 rounded-lg p-3">
                                  <MacroInput
                                    macroType="fat"
                                    value={ingredient.fat}
                                    onChange={(val) => updateIngredient(index, 'fat', val)}
                                    label="Fat"
                                    size="sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addIngredient}
                      className="flex items-center gap-2 text-primary-600 hover:text-primary-800 text-sm mt-3 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Another Ingredient
                    </button>

                    {/* Running Totals */}
                    <div className="bg-primary-50 rounded-lg p-4 mt-6">
                      <h4 className="text-sm font-medium text-primary-900 mb-3">Meal Totals</h4>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-primary-700">{totals.calories}</p>
                          <p className="text-xs text-primary-600">Cal</p>
                        </div>
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-primary-700">{totals.protein}g</p>
                          <p className="text-xs text-primary-600">Protein</p>
                        </div>
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-primary-700">{totals.carbs}g</p>
                          <p className="text-xs text-primary-600">Carbs</p>
                        </div>
                        <div>
                          <p className="text-xl sm:text-2xl font-bold text-primary-700">{totals.fat}g</p>
                          <p className="text-xs text-primary-600">Fat</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Image Upload */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meal Photo (optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Add a photo of your meal. Images are automatically compressed to save storage.
                  </p>

                  {imagePreview ? (
                    <div className="relative">
                      <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={imagePreview}
                          alt="Meal preview"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                        type="button"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {compressionInfo && (
                        <p className="text-xs text-green-600 mt-2">{compressionInfo}</p>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
                    >
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">Click to upload a photo</p>
                      <p className="text-xs text-gray-400">JPEG, PNG, WebP up to 5MB</p>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  {imageError && (
                    <p className="text-sm text-red-600 mt-2">{imageError}</p>
                  )}
                </div>

                {/* Prep Time */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prep Time (optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CUSTOM_MEAL_PREP_TIME_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPrepTime(prepTime === option.value ? null : option.value)}
                        className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                          prepTime === option.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meal Prep Instructions */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prep Instructions (optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Add step-by-step instructions for preparing this meal.
                  </p>
                  <div className="space-y-2">
                    {instructionSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-9 flex items-center justify-center text-sm font-medium text-gray-500">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => updateInstructionStep(index, e.target.value)}
                          placeholder={index === 0 ? "e.g., Preheat oven to 400°F" : "Next step..."}
                          className="input flex-1"
                        />
                        {instructionSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInstructionStep(index)}
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addInstructionStep}
                    className="flex items-center gap-2 text-primary-600 hover:text-primary-800 text-sm mt-3 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Step
                  </button>
                </div>

                {/* Share with Community */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareWithCommunity}
                      onChange={(e) => setShareWithCommunity(e.target.checked)}
                      className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Share this meal with the community
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Allow FuelRx AI to recommend this meal to other users when generating their meal plans.
                        Your name and personal info will not be shared.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Form actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={resetForm}
                    className="btn-outline flex-1"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button onClick={handleSave} className="btn-primary flex-1" disabled={saving || uploadingImage}>
                    {uploadingImage ? 'Uploading Image...' : saving ? 'Saving...' : editingMealId ? 'Update Recipe' : 'Save Recipe'}
                  </button>
                </div>
              </div>
            )}

            {/* User meals list */}
            {userMeals.length === 0 && !showCreateForm ? (
              <div className="card text-center text-gray-500">
                <p>You haven&apos;t created any recipes yet.</p>
                <p className="text-sm mt-1">
                  Create your own recipes and they can be used by the AI when generating meal plans.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {userMeals.map((meal) => (
                  <UserMealCard
                    key={meal.id}
                    meal={meal}
                    onEdit={() => startEditMeal(meal)}
                    onDelete={() => handleDelete(meal.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'quick-cook' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Meals generated using Quick Cook&apos;s single meal feature.
              </p>
              <Link href="/quick-cook" className="btn-primary">
                + Generate New Meal
              </Link>
            </div>

            {quickCookMeals.length === 0 ? (
              <div className="card text-center text-gray-500">
                <p>No Quick Cook meals saved yet.</p>
                <p className="text-sm mt-1">
                  Generate a single meal with Quick Cook and save it to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {quickCookMeals.map((meal) => (
                  <SavedSingleMealCard
                    key={meal.id}
                    meal={meal}
                    onDelete={handleDelete}
                    onUpdate={(updatedMeal) => {
                      setMeals(meals.map(m => m.id === updatedMeal.id ? updatedMeal : m))
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'party-plans' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Party prep guides generated using Quick Cook&apos;s party mode.
              </p>
              <Link href="/quick-cook?mode=party" className="btn-primary">
                + Generate Party Plan
              </Link>
            </div>

            {partyMeals.length === 0 ? (
              <div className="card text-center text-gray-500">
                <p>No party plans saved yet.</p>
                <p className="text-sm mt-1">
                  Generate a party prep guide with Quick Cook&apos;s party mode and save it to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {partyMeals.map((meal) => (
                  <SavedPartyMealCard
                    key={meal.id}
                    meal={meal}
                    onDelete={handleDelete}
                    onUpdate={(updatedMeal) => {
                      setMeals(meals.map(m => m.id === updatedMeal.id ? updatedMeal : m))
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nutrition disclaimer for Apple App Store compliance */}
        <NutritionDisclaimer className="mt-8" />

        {/* Image Validation Modal */}
        {showImageValidationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Image Not Accepted</h3>
              </div>

              <p className="text-gray-600 mb-6">
                {imageValidationMessage}
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleTryDifferentImage}
                  className="w-full btn-primary"
                >
                  Try a Different Image
                </button>
                <button
                  onClick={handleSaveWithoutImage}
                  className="w-full btn-outline"
                >
                  Save Recipe Without Image
                </button>
                <button
                  onClick={() => {
                    setShowImageValidationModal(false)
                    setImageValidationMessage(null)
                  }}
                  className="w-full text-gray-500 hover:text-gray-700 text-sm py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <MobileTabBar />
    </div>
  )
}

// User meal card component for the My Recipes tab
function UserMealCard({ meal, onEdit, onDelete }: { meal: SavedUserMeal; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      onDelete()
    }
  }

  return (
    <div className="card">
      <div
        className="flex justify-between items-start cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex gap-4">
          {meal.image_url && (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
              <Image
                src={meal.image_url}
                alt={meal.name}
                fill
                className="object-contain"
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900">{meal.name}</h3>
              {meal.is_public && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Shared
                </span>
              )}
              {meal.source_community_post_id && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Community
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
              <span>{meal.calories} kcal</span>
              <span>P: {meal.protein}g</span>
              <span>C: {meal.carbs}g</span>
              <span>F: {meal.fat}g</span>
              {meal.prep_time_minutes && (
                <span className="text-gray-500">
                  {meal.prep_time_minutes} min
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="text-primary-600 hover:text-primary-800 text-sm"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Delete
          </button>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {meal.image_url && (
            <div className="mb-4">
              <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={meal.image_url}
                  alt={meal.name}
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          )}
          {meal.ingredients && (meal.ingredients as ValidatedMealIngredient[]).length > 0 && (
            <>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Ingredients</h4>
              <div className="space-y-2">
                {(meal.ingredients as ValidatedMealIngredient[]).map((ing, idx) => (
                  <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                    <span className="text-gray-900">
                      {ing.amount && `${ing.amount} `}
                      {ing.unit && `${ing.unit} `}
                      {ing.name}
                    </span>
                    <span className="text-gray-500">
                      {ing.calories} cal | P:{ing.protein}g C:{ing.carbs}g F:{ing.fat}g
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {meal.instructions && meal.instructions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Instructions</h4>
              <ol className="space-y-2">
                {meal.instructions.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-600">
                    <span className="text-gray-400">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {meal.prep_instructions && !meal.instructions?.length && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Prep Instructions</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                {meal.prep_instructions}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
