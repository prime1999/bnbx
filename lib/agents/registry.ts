import type { Agent } from "./types";

export const REGISTRY_PAGE_SIZE = 20;

export async function fetchAgentPage(page: number): Promise<Agent[]> {
  const apiKey = process.env.SUBGRAPH_API_KEY;

  const subgraphId = process.env.BSC_SUBGRAPH_ID;

  if (!apiKey || !subgraphId) {
    throw new Error("Agent registry configuration is missing");
  }

  const skip = (page - 1) * REGISTRY_PAGE_SIZE;

  const query = `
    query GetAgents {
      agents(
        first: ${REGISTRY_PAGE_SIZE}
        skip: ${skip}
      ) {
        id
        chainId
        agentId
        owner
        createdAt
        totalFeedback

        registrationFile {
          name
          description
          image

          mcpEndpoint
          mcpTools

          a2aEndpoint
          a2aSkills

          supportedTrusts

          x402Support

          ens
          did
        }

        stakingPool {
          stakedBalanceRaw
          tokenAddress
          isSlashed
        }
      }
    }
  `;

  const endpoint =
    `https://gateway.thegraph.com/api/` +
    `${apiKey}/subgraphs/id/${subgraphId}`;

  const response = await fetch(endpoint, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      query,
    }),

    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`The Graph request failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error("GraphQL errors:", result.errors);

    throw new Error("Failed to query agent registry");
  }

  return result.data?.agents ?? [];
}
