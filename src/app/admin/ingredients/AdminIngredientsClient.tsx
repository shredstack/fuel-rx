'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type {
  AdminIngredient,
  AdminIngredientFilters,
  IngredientCategoryType,
  PaginatedAdminIngredients,
} from '@/lib/types'
import Navbar from '@/components/Navbar'
import EditIngredientModal from '@/components/admin/EditIngredientModal'

interface Props {
  initialIngredients: AdminIngredient[]
  initialTotal: number
}

const CATEGORY_OPTIONS: { value: IngredientCategoryType | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'protein', label: 'Protein' },
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'grain', label: 'Grain' },
  { value: 'fat', label: 'Fat' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_COLORS: Record<string, string> = {
  protein: 'bg-red-100 text-red-800',
  vegetable: 'bg-green-100 text-green-800',
  fruit: 'bg-orange-100 text-orange-800',
  grain: 'bg-amber-100 text-amber-800',
  fat: 'bg-yellow-100 text-yellow-800',
  dairy: 'bg-blue-100 text-blue-800',
  pantry: 'bg-gray-100 text-gray-800',
  other: 'bg-gray-100 text-gray-800',
}

type StatusFilter = 'all' | 'validated' | 'unvalidated' | 'user-added'
type SortField = 'name' | 'category' | 'created_at' | 'validated'

export default function AdminIngredientsClient({
  initialIngredients,
  initialTotal,
}: Props) {
  // Data state
  const [ingredients, setIngredients] = useState<AdminIngredient[]>(initialIngredients)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState<IngredientCategoryType | ''>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // Track if filters have ever changed from initial state
  const [hasNavigated, setHasNavigated] = useState(false)

  // Modal state
  const [editingIngredient, setEditingIngredient] = useState<AdminIngredient | null>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch ingredients when filters change
  const fetchIngredients = useCallback(async () => {
    setLoading(true)

    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (category) params.set('category', category)
    if (statusFilter === 'validated') params.set('validated', 'true')
    if (statusFilter === 'unvalidated') params.set('validated', 'false')
    if (statusFilter === 'user-added') params.set('userAddedOnly', 'true')
    params.set('sortBy', sortBy)
    params.set('sortOrder', sortOrder)
    params.set('page', page.toString())
    params.set('pageSize', pageSize.toString())

    try {
      const response = await fetch(`/api/admin/ingredients?${params}`)
      if (response.ok) {
        const data: PaginatedAdminIngredients = await response.json()
        setIngredients(data.data)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Failed to fetch ingredients:', error)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, category, statusFilter, sortBy, sortOrder, page])

  useEffect(() => {
    // Skip initial fetch since we have SSR data, but always fetch after any navigation
    const isInitialState =
      !debouncedSearch &&
      !category &&
      statusFilter === 'all' &&
      sortBy === 'name' &&
      sortOrder === 'asc' &&
      page === 1

    if (!isInitialState) {
      setHasNavigated(true)
      fetchIngredients()
    } else if (hasNavigated) {
      // User navigated back to initial state, still need to fetch
      fetchIngredients()
    }
  }, [debouncedSearch, category, statusFilter, sortBy, sortOrder, page, fetchIngredients, hasNavigated])

  // Handle select all
  const handleSelectAll = () => {
    if (selectedIds.size === ingredients.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ingredients.map(i => i.id)))
    }
  }

  // Handle single select
  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // Bulk update handlers
  const handleBulkCategory = async (newCategory: IngredientCategoryType) => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)

    try {
      const response = await fetch('/api/admin/ingredients/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_ids: Array.from(selectedIds),
          updates: { category: newCategory },
        }),
      })

      if (response.ok) {
        // Update local state
        setIngredients(prev =>
          prev.map(ing =>
            selectedIds.has(ing.id) ? { ...ing, category: newCategory } : ing
          )
        )
        setSelectedIds(new Set())
      }
    } catch (error) {
      console.error('Failed to bulk update category:', error)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkValidate = async (validated: boolean) => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)

    try {
      const response = await fetch('/api/admin/ingredients/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_ids: Array.from(selectedIds),
          updates: { validated },
        }),
      })

      if (response.ok) {
        // Update local state
        setIngredients(prev =>
          prev.map(ing =>
            selectedIds.has(ing.id) ? { ...ing, validated } : ing
          )
        )
        setSelectedIds(new Set())
      }
    } catch (error) {
      console.error('Failed to bulk validate:', error)
    } finally {
      setBulkLoading(false)
    }
  }

  // Handle edit modal save
  const handleIngredientUpdated = (updated: AdminIngredient) => {
    setIngredients(prev =>
      prev.map(ing => (ing.id === updated.id ? { ...ing, ...updated } : ing))
    )
    setEditingIngredient(null)
  }

  // Handle single ingredient delete
  const handleDeleteIngredient = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/ingredients/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setIngredients(prev => prev.filter(ing => ing.id !== id))
        setTotal(prev => prev - 1)
      } else {
        const error = await response.json()
        alert(`Failed to delete: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to delete ingredient:', error)
      alert('Failed to delete ingredient')
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    const count = selectedIds.size
    if (!confirm(`Are you sure you want to delete ${count} ingredient${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return
    }

    setBulkLoading(true)

    try {
      const response = await fetch('/api/admin/ingredients/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_ids: Array.from(selectedIds),
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // Remove deleted ingredients from local state
        setIngredients(prev => prev.filter(ing => !selectedIds.has(ing.id)))
        setTotal(prev => prev - result.deleted_count)
        setSelectedIds(new Set())

        if (result.failed_ids && result.failed_ids.length > 0) {
          alert(`Deleted ${result.deleted_count} ingredients. Failed to delete ${result.failed_ids.length} ingredients.`)
        }
      } else {
        const error = await response.json()
        alert(`Failed to delete: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to bulk delete:', error)
      alert('Failed to bulk delete ingredients')
    } finally {
      setBulkLoading(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(total / pageSize)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Ingredient Admin</h1>
          <span className="text-sm text-gray-500">({total} ingredients)</span>
        </div>

        {/* Filters Row */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search ingredients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={category}
              onChange={e => {
                setCategory(e.target.value as IngredientCategoryType | '')
                setPage(1)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex gap-2">
              {(['all', 'validated', 'unvalidated', 'user-added'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    setPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' && 'All'}
                  {status === 'validated' && 'Validated'}
                  {status === 'unvalidated' && 'Unvalidated'}
                  {status === 'user-added' && 'User Added'}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortField)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="created_at">Date Added</option>
                <option value="validated">Validated</option>
              </select>
              <button
                onClick={() => setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
                className="p-2 hover:bg-gray-100 rounded"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4 flex items-center gap-4">
            <span className="font-medium text-primary-800">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-primary-700">Set category:</span>
              <select
                onChange={e => {
                  if (e.target.value) {
                    handleBulkCategory(e.target.value as IngredientCategoryType)
                    e.target.value = ''
                  }
                }}
                disabled={bulkLoading}
                className="px-2 py-1 border border-primary-300 rounded text-sm"
                defaultValue=""
              >
                <option value="" disabled>Select...</option>
                {CATEGORY_OPTIONS.filter(o => o.value).map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => handleBulkValidate(true)}
              disabled={bulkLoading}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Validate
            </button>
            <button
              onClick={() => handleBulkValidate(false)}
              disabled={bulkLoading}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              Unvalidate
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-primary-600 hover:text-primary-800 text-sm"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === ingredients.length && ingredients.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : ingredients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No ingredients found
                    </td>
                  </tr>
                ) : (
                  ingredients.map(ingredient => (
                    <tr
                      key={ingredient.id}
                      className={`hover:bg-gray-50 ${
                        selectedIds.has(ingredient.id) ? 'bg-primary-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ingredient.id)}
                          onChange={() => handleSelect(ingredient.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {ingredient.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ingredient.category ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              CATEGORY_COLORS[ingredient.category] || CATEGORY_COLORS.other
                            }`}
                          >
                            {ingredient.category}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ingredient.validated ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-sm">Validated</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" strokeWidth={2} />
                            </svg>
                            <span className="text-sm">Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ingredient.is_user_added ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            User Added
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(ingredient.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingIngredient(ingredient)}
                            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteIngredient(ingredient.id, ingredient.name)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1} to{' '}
                {Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 border rounded text-sm ${
                        page === pageNum
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {editingIngredient && (
        <EditIngredientModal
          ingredient={editingIngredient}
          onClose={() => setEditingIngredient(null)}
          onSave={handleIngredientUpdated}
        />
      )}
    </div>
  )
}
