'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type {
  UserProfile,
  MealType,
  PartyType,
  GeneratedMeal,
  PartyPrepGuide,
  CustomMealPrepTime,
} from '@/lib/types'
import ThemeSelector, { type ThemeSelection } from '@/components/ThemeSelector'
import MealTypeSelector from '@/components/MealTypeSelector'
import PartyTypeSelector from '@/components/PartyTypeSelector'
import GuestCountInput from '@/components/GuestCountInput'
import SingleMealResult from '@/components/SingleMealResult'
import PartyPrepGuideDisplay from '@/components/PartyPrepGuideDisplay'
import IngredientSelector, { type IngredientSelection } from '@/components/IngredientSelector'
import PaywallModal from '@/components/PaywallModal'
import { useSubscription } from '@/hooks/useSubscription'

interface Props {
  profile: UserProfile
}

type QuickCookMode = 'normal' | 'party'

const LOADING_MESSAGES_NORMAL = [
  'Finding the perfect ingredients...',
  'Calculating optimal macros...',
  'Crafting your personalized meal...',
  'Adding the finishing touches...',
]

const LOADING_MESSAGES_PARTY = [
  'Planning your perfect party menu...',
  'Scaling recipes for your guest count...',
  'Building your prep timeline...',
  'Creating your shopping list...',
  'Adding pro tips from the kitchen...',
]

// Convert prep_time_minutes to CustomMealPrepTime format for social feed
function minutesToPrepTime(minutes: number): CustomMealPrepTime {
  if (minutes <= 5) return '5_or_less'
  if (minutes <= 15) return '15'
  if (minutes <= 30) return '30'
  return 'more_than_30'
}

export default function QuickCookClient({ profile }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  // Mode state
  const initialMode = (searchParams.get('mode') as QuickCookMode) || 'normal'
  const [mode, setMode] = useState<QuickCookMode>(initialMode)

  // Normal mode state
  const [mealType, setMealType] = useState<MealType>('dinner')
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>({ type: 'none' })
  const [ingredientSelection, setIngredientSelection] = useState<IngredientSelection>({
    selectedIngredients: [],
    usageMode: 'only_selected',
  })
  const [customInstructions, setCustomInstructions] = useState('')

  // Party mode state
  const [guestCount, setGuestCount] = useState(8)
  const [partyType, setPartyType] = useState<PartyType>('casual_gathering')
  const [recipeUrl, setRecipeUrl] = useState('')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

  // Results
  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(null)
  const [generatedPartyGuide, setGeneratedPartyGuide] = useState<PartyPrepGuide | null>(null)

  // Saving state
  const [saving, setSaving] = useState(false)

  // Share with community - default to user's social_feed_enabled setting
  const [shareWithCommunity, setShareWithCommunity] = useState(profile.social_feed_enabled || false)

  // Subscription state
  const [showPaywall, setShowPaywall] = useState(false)
  const { refresh: refreshSubscription } = useSubscription()

  // Rotate loading messages
  useEffect(() => {
    if (!generating) return

    const messages = mode === 'normal' ? LOADING_MESSAGES_NORMAL : LOADING_MESSAGES_PARTY
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % messages.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [generating, mode])

  // Update URL when mode changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mode', mode)
    router.replace(`/quick-cook?${params.toString()}`, { scroll: false })
  }, [mode, router, searchParams])

  const handleModeChange = (newMode: QuickCookMode) => {
    setMode(newMode)
    // Clear results when switching modes
    setGeneratedMeal(null)
    setGeneratedPartyGuide(null)
    setError(null)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setLoadingMessageIndex(0)
    setGeneratedMeal(null)
    setGeneratedPartyGuide(null)

    try {
      const themeId =
        themeSelection.type === 'specific' ? themeSelection.themeId :
        themeSelection.type === 'surprise' ? 'surprise' :
        'none'

      const response = await fetch('/api/quick-cook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          mealType: mode === 'normal' ? mealType : undefined,
          guestCount: mode === 'party' ? guestCount : undefined,
          partyType: mode === 'party' ? partyType : undefined,
          recipeUrl: mode === 'party' && recipeUrl.trim() ? recipeUrl.trim() : undefined,
          themeId,
          customInstructions: customInstructions.trim() || undefined,
          selectedIngredients: mode === 'normal' && ingredientSelection.selectedIngredients.length > 0
            ? ingredientSelection.selectedIngredients
            : undefined,
          ingredientUsageMode: mode === 'normal' && ingredientSelection.selectedIngredients.length > 0
            ? ingredientSelection.usageMode
            : undefined,
        }),
      })

      if (response.status === 402) {
        setShowPaywall(true)
        setGenerating(false)
        return
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate')
      }

      const data = await response.json()

      if (mode === 'normal') {
        setGeneratedMeal(data.meal)
      } else {
        setGeneratedPartyGuide(data.guide)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveMeal = async () => {
    if (!generatedMeal) return

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Use the shareWithCommunity state (user can toggle before saving)
      const shouldShare = shareWithCommunity

      // Insert into meals table with all single meal fields
      const { data: savedMeal, error: insertError } = await supabase.from('meals').insert({
        name: generatedMeal.name,
        name_normalized: generatedMeal.name.toLowerCase().trim(),
        meal_type: generatedMeal.type,
        emoji: generatedMeal.emoji,
        description: generatedMeal.description,
        ingredients: generatedMeal.ingredients,
        instructions: generatedMeal.instructions,
        calories: Math.round(generatedMeal.macros.calories),
        protein: generatedMeal.macros.protein,
        carbs: generatedMeal.macros.carbs,
        fat: generatedMeal.macros.fat,
        prep_time_minutes: generatedMeal.prep_time_minutes,
        cook_time_minutes: generatedMeal.cook_time_minutes,
        servings: generatedMeal.servings,
        tips: generatedMeal.tips || [],
        is_user_created: true,
        is_public: shouldShare,
        source_type: 'quick_cook',
        source_user_id: user.id,
      }).select().single()

      if (insertError) {
        // Check if it's a unique constraint violation
        if (insertError.code === '23505') {
          throw new Error('You already have a meal with this name saved')
        }
        throw insertError
      }

      // Auto-share to community feed if user has community enabled
      if (shouldShare && savedMeal) {
        const { error: shareError } = await supabase.from('social_feed_posts').insert({
          user_id: user.id,
          source_type: 'quick_cook',
          source_meals_table_id: savedMeal.id,
          meal_name: savedMeal.name,
          calories: Math.round(savedMeal.calories),
          protein: Math.round(savedMeal.protein),
          carbs: Math.round(savedMeal.carbs),
          fat: Math.round(savedMeal.fat),
          image_url: savedMeal.image_url,
          prep_time: minutesToPrepTime(savedMeal.prep_time_minutes),
          ingredients: savedMeal.ingredients,
          instructions: savedMeal.instructions,
          meal_type: savedMeal.meal_type,
        })
        if (shareError) {
          console.error('Error sharing to community feed:', shareError)
        }
      }

      // Navigate to My Meals - Quick Cook tab
      router.push('/custom-meals?tab=quick-cook')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePartyGuide = async () => {
    if (!generatedPartyGuide) return

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Use the shareWithCommunity state (user can toggle before saving)
      const shouldShare = shareWithCommunity

      const partyData = {
        dishes: generatedPartyGuide.dishes,
        timeline: generatedPartyGuide.timeline,
        shopping_list: generatedPartyGuide.shopping_list,
        pro_tips: generatedPartyGuide.pro_tips,
        serves: generatedPartyGuide.serves,
        estimated_total_prep_time: generatedPartyGuide.estimated_total_prep_time,
        estimated_active_time: generatedPartyGuide.estimated_active_time,
      }

      // Insert into meals table as party_meal with full party_data
      const { data: savedMeal, error: insertError } = await supabase.from('meals').insert({
        name: generatedPartyGuide.name,
        name_normalized: generatedPartyGuide.name.toLowerCase().trim(),
        description: generatedPartyGuide.description,
        // Party meals don't have standard macros - set to 0
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        // Store the full party guide data
        party_data: partyData,
        is_user_created: true,
        is_public: shouldShare,
        source_type: 'party_meal',
        source_user_id: user.id,
      }).select().single()

      if (insertError) {
        // Check if it's a unique constraint violation
        if (insertError.code === '23505') {
          throw new Error('You already have a party plan with this name saved')
        }
        throw insertError
      }

      // Auto-share to community feed if user has community enabled
      if (shouldShare && savedMeal) {
        await supabase.from('social_feed_posts').insert({
          user_id: user.id,
          source_type: 'party_meal',
          source_meals_table_id: savedMeal.id,
          meal_name: savedMeal.name,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          party_data: partyData,
        })
      }

      // Navigate to My Meals - Party Plans tab
      router.push('/custom-meals?tab=party-plans')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save party plan')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = () => {
    setGeneratedMeal(null)
    setGeneratedPartyGuide(null)
    handleGenerate()
  }

  const loadingMessages = mode === 'normal' ? LOADING_MESSAGES_NORMAL : LOADING_MESSAGES_PARTY

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-3xl">⚡</span>
              Quick Cook
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-8 print:hidden">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200 inline-flex">
            <button
              onClick={() => handleModeChange('normal')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'normal'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Single Meal
            </button>
            <button
              onClick={() => handleModeChange('party')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'party'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Party Mode 🎉
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 print:hidden">
            {error}
          </div>
        )}

        {/* Results */}
        {generatedMeal && (
          <SingleMealResult
            meal={generatedMeal}
            onSave={handleSaveMeal}
            onRegenerate={handleRegenerate}
            saving={saving}
            socialFeedEnabled={profile.social_feed_enabled || false}
            shareWithCommunity={shareWithCommunity}
            onShareWithCommunityChange={setShareWithCommunity}
          />
        )}

        {generatedPartyGuide && (
          <PartyPrepGuideDisplay
            guide={generatedPartyGuide}
            onRegenerate={handleRegenerate}
            onSave={handleSavePartyGuide}
            saving={saving}
            socialFeedEnabled={profile.social_feed_enabled || false}
            shareWithCommunity={shareWithCommunity}
            onShareWithCommunityChange={setShareWithCommunity}
          />
        )}

        {/* Form - hide when results are shown */}
        {!generatedMeal && !generatedPartyGuide && (
          <div className="card max-w-xl mx-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {mode === 'normal'
                ? "What kind of meal would you like?"
                : "Tell us about your party"}
            </h2>

            <div className="space-y-6">
              {/* Normal Mode Options */}
              {mode === 'normal' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meal Type
                    </label>
                    <MealTypeSelector
                      value={mealType}
                      onChange={setMealType}
                      disabled={generating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Theme (optional)
                    </label>
                    <ThemeSelector
                      value={themeSelection}
                      onChange={setThemeSelection}
                      disabled={generating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ingredients (optional)
                    </label>
                    <IngredientSelector
                      value={ingredientSelection}
                      onChange={setIngredientSelection}
                      disabled={generating}
                    />
                  </div>
                </>
              )}

              {/* Party Mode Options */}
              {mode === 'party' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How many guests?
                    </label>
                    <GuestCountInput
                      value={guestCount}
                      onChange={setGuestCount}
                      disabled={generating}
                      min={2}
                      max={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What kind of party?
                    </label>
                    <PartyTypeSelector
                      value={partyType}
                      onChange={setPartyType}
                      disabled={generating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Theme (optional)
                    </label>
                    <ThemeSelector
                      value={themeSelection}
                      onChange={setThemeSelection}
                      disabled={generating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipe URL (optional)
                    </label>
                    <input
                      type="url"
                      value={recipeUrl}
                      onChange={(e) => setRecipeUrl(e.target.value)}
                      disabled={generating}
                      placeholder="https://example.com/recipe..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Have a recipe you want to scale? Paste the URL and we&apos;ll incorporate it into your party plan.
                    </p>
                  </div>
                </>
              )}

              {/* Custom Instructions (both modes) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any special requests? (optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  disabled={generating}
                  placeholder={
                    mode === 'normal'
                      ? "e.g., I have chicken thighs in the fridge, keep it under 500 calories..."
                      : "e.g., NYE party, want something impressive but not too hard, half the guests are vegetarian..."
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none h-24 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full py-3 text-lg"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {loadingMessages[loadingMessageIndex]}
                  </span>
                ) : mode === 'normal' ? (
                  'Generate Meal'
                ) : (
                  'Generate Party Plan'
                )}
              </button>

              {generating && (
                <p className="text-center text-sm text-gray-500">
                  {mode === 'normal'
                    ? 'This usually takes 15-30 seconds...'
                    : 'This usually takes 30-60 seconds...'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Generate Another Button - shown when results are visible */}
        {(generatedMeal || generatedPartyGuide) && (
          <div className="mt-6 text-center print:hidden">
            <button
              onClick={() => {
                setGeneratedMeal(null)
                setGeneratedPartyGuide(null)
              }}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              ← Start Over
            </button>
          </div>
        )}
      </main>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => {
          setShowPaywall(false)
          refreshSubscription()
        }}
      />
    </div>
  )
}
