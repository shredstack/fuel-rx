'use client'

import { useState } from 'react'
import type { UserProfile, IngredientPreferenceWithDetails, MealPreference, DietaryPreference } from '@/lib/types'
import DietaryRestrictionsEditor from './DietaryRestrictionsEditor'
import IngredientPreferencesModal from './IngredientPreferencesModal'

interface DietaryPreferencesCardProps {
  profile: UserProfile
  ingredientPrefs: IngredientPreferenceWithDetails[]
  mealPrefs: MealPreference[]
}

const RESTRICTION_LABELS: Record<DietaryPreference, string> = {
  no_restrictions: 'No Restrictions',
  vegetarian: 'Vegetarian',
  paleo: 'Paleo',
  gluten_free: 'Gluten-Free',
  dairy_free: 'Dairy-Free',
}

export default function DietaryPreferencesCard({
  profile,
  ingredientPrefs,
  mealPrefs
}: DietaryPreferencesCardProps) {
  const [showRestrictionsEditor, setShowRestrictionsEditor] = useState(false)
  const [showIngredientsModal, setShowIngredientsModal] = useState(false)
  const [ingredientModalType, setIngredientModalType] = useState<'liked' | 'disliked'>('liked')

  const likedIngredients = ingredientPrefs.filter(p => p.preference === 'liked')
  const dislikedIngredients = ingredientPrefs.filter(p => p.preference === 'disliked')

  // Filter out 'no_restrictions' when displaying
  const restrictions = profile.dietary_prefs.filter(r => r !== 'no_restrictions')

  const openIngredientsModal = (type: 'liked' | 'disliked') => {
    setIngredientModalType(type)
    setShowIngredientsModal(true)
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span>🥗</span> Dietary Preferences
          </h2>
          <button
            onClick={() => setShowRestrictionsEditor(true)}
            className="text-green-600 text-sm font-medium hover:text-green-700"
          >
            Edit
          </button>
        </div>

        {/* Dietary Restrictions */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Restrictions</h3>
          {restrictions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {restrictions.map(r => (
                <span
                  key={r}
                  className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm"
                >
                  {RESTRICTION_LABELS[r]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No restrictions set</p>
          )}
        </div>

        {/* Liked Ingredients */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              Liked Ingredients ({likedIngredients.length})
            </h3>
            <button
              onClick={() => openIngredientsModal('liked')}
              className="text-green-600 text-xs hover:text-green-700"
            >
              View All
            </button>
          </div>
          {likedIngredients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {likedIngredients.slice(0, 5).map(p => (
                <span
                  key={p.ingredient_id}
                  className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                >
                  {p.ingredient_name}
                </span>
              ))}
              {likedIngredients.length > 5 && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  +{likedIngredients.length - 5} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">None set - tap View All to add</p>
          )}
        </div>

        {/* Disliked Ingredients */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              Disliked Ingredients ({dislikedIngredients.length})
            </h3>
            <button
              onClick={() => openIngredientsModal('disliked')}
              className="text-green-600 text-xs hover:text-green-700"
            >
              View All
            </button>
          </div>
          {dislikedIngredients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dislikedIngredients.slice(0, 5).map(p => (
                <span
                  key={p.ingredient_id}
                  className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm"
                >
                  {p.ingredient_name}
                </span>
              ))}
              {dislikedIngredients.length > 5 && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  +{dislikedIngredients.length - 5} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">None set - tap View All to add</p>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRestrictionsEditor && (
        <DietaryRestrictionsEditor
          currentRestrictions={profile.dietary_prefs}
          onClose={() => setShowRestrictionsEditor(false)}
        />
      )}

      {showIngredientsModal && (
        <IngredientPreferencesModal
          type={ingredientModalType}
          preferences={ingredientModalType === 'liked' ? likedIngredients : dislikedIngredients}
          onClose={() => setShowIngredientsModal(false)}
        />
      )}
    </>
  )
}
