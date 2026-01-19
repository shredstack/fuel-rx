'use client'

import { useState } from 'react'
import Link from 'next/link'
import FeedPostCard from '@/components/FeedPostCard'
import Navbar from '@/components/Navbar'
import MobileTabBar from '@/components/MobileTabBar'
import {
  useSocialFeed,
  useSavePost,
  useUnsavePost,
  useDeletePost,
} from '@/hooks/queries/useSocialFeed'

interface Props {
  socialEnabled: boolean
  userName: string
}

type FilterType = 'all' | 'following' | 'my_posts'

export default function CommunityFeedClient({ socialEnabled, userName }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  // Use React Query infinite query for the feed
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useSocialFeed(filter)

  // Mutation hooks
  const savePostMutation = useSavePost()
  const unsavePostMutation = useUnsavePost()
  const deletePostMutation = useDeletePost()

  // Flatten all pages into a single array of posts
  const posts = data?.pages.flatMap(page => page.posts) ?? []

  const handleFilterChange = (newFilter: FilterType) => {
    if (newFilter !== filter) {
      setFilter(newFilter)
    }
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  const handleSave = async (postId: string) => {
    await savePostMutation.mutateAsync(postId)
  }

  const handleUnsave = async (postId: string) => {
    await unsavePostMutation.mutateAsync(postId)
  }

  const handleDelete = async (postId: string) => {
    await deletePostMutation.mutateAsync(postId)
  }

  if (!socialEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Navbar />

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="card">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Join the FuelRx Community
            </h2>
            <p className="text-gray-600 mb-6">
              Enable the social feed to discover meals from other users, share your creations,
              and connect with people who share your nutrition goals.
            </p>
            <Link href="/settings/social" className="btn-primary inline-block">
              Enable Social Feed
            </Link>
          </div>
        </main>

        <MobileTabBar />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            onClick={() => handleFilterChange('all')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Meals
          </button>
          <button
            onClick={() => handleFilterChange('following')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              filter === 'following'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Following
          </button>
          <button
            onClick={() => handleFilterChange('my_posts')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              filter === 'my_posts'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Posts
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error instanceof Error ? error.message : 'Failed to load feed'}
            <button
              onClick={() => refetch()}
              className="ml-2 text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="card text-center py-12">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'following'
                ? 'No meals from people you follow'
                : filter === 'my_posts'
                  ? 'You haven\'t shared any meals yet'
                  : 'No meals in the feed yet'}
            </h3>
            <p className="text-gray-500 mb-4">
              {filter === 'following'
                ? 'Follow some users to see their shared meals here.'
                : filter === 'my_posts'
                  ? 'Share your favorite meals, custom creations, or cooked dishes with the community!'
                  : 'Be the first to share a meal with the community!'}
            </p>
            {filter === 'following' && (
              <Link href="/community/users" className="btn-primary inline-block">
                Find People to Follow
              </Link>
            )}
            {filter === 'my_posts' && (
              <Link href="/meals" className="btn-primary inline-block">
                Go to My Meals
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map(post => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  onSave={handleSave}
                  onUnsave={handleUnsave}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {hasNextPage && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingNextPage}
                  className="btn-outline"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <MobileTabBar />
    </div>
  )
}
