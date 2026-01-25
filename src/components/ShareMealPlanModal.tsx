'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CommunityUser } from '@/lib/types';

interface ShareMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlanId: string;
  mealPlanTitle: string;
}

export function ShareMealPlanModal({
  isOpen,
  onClose,
  mealPlanId,
  mealPlanTitle,
}: ShareMealPlanModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sharedUserIds, setSharedUserIds] = useState<Set<string>>(new Set());
  const [includeGroceryItems, setIncludeGroceryItems] = useState(true);
  const [hasGroceryItems, setHasGroceryItems] = useState(false);
  const [checkingGroceryItems, setCheckingGroceryItems] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/community-users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError('Failed to load community users. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Check if there are grocery items when modal opens
  useEffect(() => {
    const checkGroceryItems = async () => {
      if (!isOpen) return;

      setCheckingGroceryItems(true);
      try {
        const res = await fetch(`/api/meal-plans/${mealPlanId}/has-grocery-items`);
        if (res.ok) {
          const data = await res.json();
          setHasGroceryItems(data.hasItems);
        }
      } catch (err) {
        console.error('Error checking grocery items:', err);
      } finally {
        setCheckingGroceryItems(false);
      }
    };

    checkGroceryItems();
  }, [isOpen, mealPlanId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setError(null);
      setSuccessMessage(null);
      setSharedUserIds(new Set());
      setIncludeGroceryItems(true);
      setHasGroceryItems(false);
    }
  }, [isOpen]);

  const handleShare = async (user: CommunityUser) => {
    setSharing(user.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/meal-plans/${mealPlanId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: user.id,
          includeGroceryItems: includeGroceryItems && hasGroceryItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to share meal plan');
      }

      setSuccessMessage(`Shared with ${user.display_name || user.name}!`);
      setSharedUserIds(prev => new Set([...prev, user.id]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share meal plan');
    } finally {
      setSharing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative bg-white w-full sm:max-w-lg sm:rounded-xl shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-4 py-3 sm:rounded-t-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Share Meal Plan</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Meal plan reference */}
            <div className="mt-2 p-2 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-500">Sharing: </span>
              <span className="font-medium">{mealPlanTitle}</span>
            </div>

            {/* Include grocery items option - only show if user has items */}
            {!checkingGroceryItems && hasGroceryItems && (
              <div className="mt-3 flex items-start gap-3 p-3 bg-primary-50 rounded-lg">
                <input
                  type="checkbox"
                  id="include-grocery-items"
                  checked={includeGroceryItems}
                  onChange={(e) => setIncludeGroceryItems(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="include-grocery-items" className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium text-gray-900">Include my grocery list items</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Share your staples and custom items along with the meal plan
                  </p>
                </label>
              </div>
            )}

            {/* Search */}
            <div className="mt-3 relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search community members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">
                {successMessage}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery
                  ? 'No community members found matching your search.'
                  : 'No community members available to share with.'}
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onShare={handleShare}
                    isSharing={sharing === user.id}
                    isShared={sharedUserIds.has(user.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface UserCardProps {
  user: CommunityUser;
  onShare: (user: CommunityUser) => void;
  isSharing: boolean;
  isShared: boolean;
}

function UserCard({ user, onShare, isSharing, isShared }: UserCardProps) {
  const displayName = user.display_name || user.name || 'Community Member';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
          {user.profile_photo_url ? (
            <img
              src={user.profile_photo_url}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-primary-600 font-medium text-sm">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div>
          <div className="font-medium text-gray-900 flex items-center gap-2">
            {displayName}
            {user.is_following && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                Following
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => onShare(user)}
        disabled={isSharing || isShared}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isShared
            ? 'bg-green-100 text-green-700 cursor-default'
            : isSharing
            ? 'bg-gray-200 text-gray-500 cursor-wait'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {isShared ? (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Shared
          </span>
        ) : isSharing ? (
          <span className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500" />
            Sharing...
          </span>
        ) : (
          'Share'
        )}
      </button>
    </div>
  );
}
