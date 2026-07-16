import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export interface AdminCostFeatureRow {
  promptType: string;
  model: string;
  calls: number;
  uniqueUsers: number;
  outputTokens: number;
  approxInputTokens: number;
  avgDurationMs: number | null;
  estCost: number;
  estCostPerCall: number;
}

export interface AdminCostDailyRow {
  day: string;
  calls: number;
  estCost: number;
}

export interface AdminCostUserRow {
  userId: string;
  email: string | null;
  calls: number;
  outputTokens: number;
  approxInputTokens: number;
  estCost: number;
}

export interface AdminCostsResponse {
  days: number;
  totals: {
    calls: number;
    outputTokens: number;
    approxInputTokens: number;
    estCost: number;
    estWeeklyCost: number;
    topUserCount: number;
  };
  byFeature: AdminCostFeatureRow[];
  daily: AdminCostDailyRow[];
  topUsers: AdminCostUserRow[];
}

export function useAdminCosts(days: number) {
  return useQuery<AdminCostsResponse>({
    queryKey: queryKeys.admin.costs(days),
    queryFn: async () => {
      const response = await fetch(`/api/admin/costs?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch cost stats');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // aggregates change slowly; avoid refetch spam
  });
}
