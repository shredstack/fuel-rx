'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { IngredientPreferenceWithDetails } from '@/lib/types'
// Icon components
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

interface IngredientPreferencesModalProps {
  type: 'liked' | 'disliked'
  preferences: IngredientPreferenceWithDetails[]
  onClose: () => void
}

interface SearchResult {
  id: string
  name: string
}

export default function IngredientPreferencesModal({
  type,
  preferences,
  onClose
}: IngredientPreferencesModalProps) {
  const supabase = createClient()
  const [items, setItems] = useState(preferences)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data } = await supabase
        .from('ingredient_nutrition')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .limit(10)

      // Filter out already-added ingredients
      const existingIds = items.map(i => i.ingredient_id)
      setSearchResults((data || []).filter(d => !existingIds.includes(d.id)))
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const addIngredient = async (ingredient: SearchResult) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('ingredient_preferences')
        .insert({
          user_id: user.id,
          ingredient_id: ingredient.id,
          preference: type
        })

      if (error) throw error

      // Add to local state
      setItems([...items, {
        id: crypto.randomUUID(),
        user_id: user.id,
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.name,
        name_normalized: ingredient.name.toLowerCase(),
        preference: type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: null,
      }])
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      console.error('Failed to add ingredient:', err)
    }
  }

  const removeIngredient = async (ingredientId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('ingredient_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('ingredient_id', ingredientId)

      if (error) throw error

      setItems(items.filter(i => i.ingredient_id !== ingredientId))
    } catch (err) {
      console.error('Failed to remove ingredient:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {type === 'liked' ? '👍 Liked' : '👎 Disliked'} Ingredients
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search ingredients to add..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
              {searchResults.map(result => (
                <button
                  key={result.id}
                  onClick={() => addIngredient(result)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <span>{result.name}</span>
                  <PlusIcon className="w-5 h-5 text-green-500" />
                </button>
              ))}
            </div>
          )}

          {searching && (
            <p className="text-sm text-gray-500 mt-2">Searching...</p>
          )}
        </div>

        {/* Current Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No {type} ingredients yet. Use the search above to add some!
            </p>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div
                  key={item.ingredient_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium">{item.ingredient_name}</span>
                  <button
                    onClick={() => removeIngredient(item.ingredient_id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
