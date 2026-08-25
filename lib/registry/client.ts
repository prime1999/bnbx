import { RawAgent } from "../agents/types";
import { AGENTS_QUERY } from "./queries";

// Fetches paginated raw agents directly from The Graph Gateway API endpoint
export async function fetchAgentsFromGraph(params: {
  page: number;
  limit: number;
}): Promise<RawAgent[]> {
  const { page, limit } = params;

  // Calculate skip offset for GraphQL pagination query
  const skip = (page - 1) * limit;

  const apikey = process.env.SUBGRAPH_API_KEY;
  const subgraphId = process.env.BSC_SUBGRAPH_ID;

  const endpoint = `https://gateway.thegraph.com/api/${apikey}/subgraphs/id/${subgraphId}`;

  if (!endpoint) {
    console.warn(
      "[Subgraph Client] SUBGRAPH_GATEWAY_URL is missing. Returning empty list.",
    );
    return [];
  }

  try {
    // Send HTTP POST request to Subgraph Gateway GraphQL endpoint
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: AGENTS_QUERY,
        variables: { first: limit, skip },
      }),
      // Revalidate cache every 60 seconds at the HTTP level
      next: { revalidate: 60 },
    });

    const json = await response.json();

    console.log({ json, error: json.errors });

    // Return array of raw agent entities from GraphQL response data payload
    return (json?.data?.agents as RawAgent[]) || [];
  } catch (error) {
    console.error(
      "[Subgraph Client Error] Failed to fetch agents from Subgraph:",
      error,
    );
    return [];
  }
}
