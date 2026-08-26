"use client";

import { ProcessedAgent } from "@/lib/agents/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

interface UseAgentsOptions {
  query?: string;
  page?: number;
  limit?: number;
  category?: string;
}

interface UnifiedAgentsApiResponse {
  pagination: {
    page: number;
    limit: number;
    totalMatches: number;
    totalPages: number;
  };
  results: ProcessedAgent[];
  intent?: Record<string, unknown>;
}

export function useAgents(options: UseAgentsOptions = {}) {
  const { query = "", page = 1, limit = 20, category = "all" } = options;

  return useQuery<UnifiedAgentsApiResponse>({
    queryKey: ["agents", query, page, limit, category],

    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (query.trim()) params.append("q", query);
      if (category && category !== "all") params.append("category", category);

      // Route to search endpoint if query is provided, else standard list endpoint
      const endpoint = "/api/agents";
      const response = await fetch(`${endpoint}?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch agents.");
      }

      return response.json();
    },

    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
