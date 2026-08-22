"use client";

import { useQuery } from "@tanstack/react-query";

import { Agent } from "@/lib/agents/types";

interface AgentsResponse {
  agents: Agent[];

  page: number;

  limit: number;

  category: string | null;

  hasNextPage: boolean;

  scannedRegistryPages?: number;
}

/**
 * Fetch agents from our API.
 */
async function fetchAgents({
  page,
  category,
}: {
  page: number;

  category?: string;
}): Promise<AgentsResponse> {
  /**
   * Build the URL.
   */
  const params = new URLSearchParams();

  params.set("page", String(page));

  if (category) {
    params.set("category", category);
  }

  const response = await fetch(`/api/agents?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch agents");
  }

  return response.json();
}

/**
 * Main React Query hook.
 */
export function useAgents({
  page = 1,
  category,
}: {
  page?: number;

  category?: string;
}) {
  return useQuery({
    /**
     * This is extremely important.
     *
     * React Query stores each page/category
     * combination independently.
     */
    queryKey: [
      "agents",
      {
        page,
        category: category ?? null,
      },
    ],

    queryFn: () =>
      fetchAgents({
        page,
        category,
      }),

    /**
     * Keep the previous page visible while
     * the next page is loading.
     */
    placeholderData: (previousData) => previousData,
  });
}
