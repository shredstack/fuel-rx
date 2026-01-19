import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { SocialFeedPost } from '@/lib/types';

type FilterType = 'all' | 'following' | 'my_posts';

interface FeedResponse {
  posts: SocialFeedPost[];
  hasMore: boolean;
}

/**
 * Infinite query hook for fetching the social feed with pagination.
 */
export function useSocialFeed(filter: FilterType) {
  return useInfiniteQuery({
    queryKey: queryKeys.socialFeed.list(filter),
    queryFn: async ({ pageParam = 1 }): Promise<FeedResponse> => {
      const response = await fetch(
        `/api/social-feed?page=${pageParam}&limit=20&filter=${filter}`
      );
      if (!response.ok) throw new Error('Failed to fetch feed');
      return response.json();
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
    initialPageParam: 1,
  });
}

/**
 * Mutation hook for saving a post.
 * Optimistically updates the is_saved status across all cached pages.
 */
export function useSavePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/social-feed/${postId}/save`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to save meal');
    },

    onMutate: async (postId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.socialFeed.all });

      // Optimistically update is_saved across all cached feed pages
      queryClient.setQueriesData(
        { queryKey: queryKeys.socialFeed.all },
        (old: unknown) => {
          const data = old as { pages?: FeedResponse[]; pageParams?: number[] } | undefined;
          if (!data?.pages) return old;
          return {
            ...data,
            pages: data.pages.map((page: FeedResponse) => ({
              ...page,
              posts: page.posts.map((post: SocialFeedPost) =>
                post.id === postId ? { ...post, is_saved: true } : post
              ),
            })),
          };
        }
      );
    },

    onError: () => {
      // Refetch to restore correct state
      queryClient.invalidateQueries({ queryKey: queryKeys.socialFeed.all });
    },
  });
}

/**
 * Mutation hook for unsaving a post.
 * Optimistically updates the is_saved status across all cached pages.
 */
export function useUnsavePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/social-feed/${postId}/save`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to unsave meal');
    },

    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.socialFeed.all });

      queryClient.setQueriesData(
        { queryKey: queryKeys.socialFeed.all },
        (old: unknown) => {
          const data = old as { pages?: FeedResponse[]; pageParams?: number[] } | undefined;
          if (!data?.pages) return old;
          return {
            ...data,
            pages: data.pages.map((page: FeedResponse) => ({
              ...page,
              posts: page.posts.map((post: SocialFeedPost) =>
                post.id === postId ? { ...post, is_saved: false } : post
              ),
            })),
          };
        }
      );
    },

    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialFeed.all });
    },
  });
}

/**
 * Mutation hook for deleting a post.
 * Optimistically removes the post from all cached pages.
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/social-feed/${postId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete post');
    },

    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.socialFeed.all });

      queryClient.setQueriesData(
        { queryKey: queryKeys.socialFeed.all },
        (old: unknown) => {
          const data = old as { pages?: FeedResponse[]; pageParams?: number[] } | undefined;
          if (!data?.pages) return old;
          return {
            ...data,
            pages: data.pages.map((page: FeedResponse) => ({
              ...page,
              posts: page.posts.filter((post: SocialFeedPost) => post.id !== postId),
            })),
          };
        }
      );
    },

    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialFeed.all });
    },
  });
}
