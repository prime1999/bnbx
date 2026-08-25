"use client";

import { ProcessedAgent } from "@/lib/agents/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export interface UserIntent {
  rawQuery: string;
  targetCategory: string;
  riskTolerance: "conservative" | "moderate" | "aggressive" | "any";
  extractedKeywords: string[];
}

interface UseAgentSearchOptions {
  query: string;
  page?: number;
  limit?: number;
  category?: string;
  enabled?: boolean;
}

interface SearchApiResponse {
  query: string;
  intent: UserIntent;
  pagination: {
    page: number;
    limit: number;
    totalMatches: number;
    totalPages: number;
  };
  results: ProcessedAgent[];
}

export function useAgentSearch(options: UseAgentSearchOptions) {
  const { query, page = 1, limit = 10, category, enabled = true } = options;

  return useQuery<SearchApiResponse>({
    // Include query, page, limit, and category in cache key
    queryKey: ["agent-search", query, page, limit, category],

    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (category && category !== "all") {
        params.append("category", category);
      }

      const response = await fetch(`/api/search/agents?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to execute agent discovery search.",
        );
      }

      return response.json();
    },

    // Do not run search on empty prompts
    enabled: enabled && Boolean(query.trim()),

    // Keeps old page UI visible without flickering during page/filter switches
    placeholderData: keepPreviousData,

    staleTime: 1000 * 60 * 2, // 2 Minutes
    gcTime: 1000 * 60 * 10, // 10 Minutes
  });
}
