import { NextResponse } from "next/server";
import { syncAndAutoCategorizeAgents } from "@/lib/search/sync";

export async function GET() {
  return handleSync();
}
export async function POST() {
  return handleSync();
}

async function handleSync() {
  try {
    const apiKey = process.env.SUBGRAPH_API_KEY;
    const subgraphId = process.env.BSC_SUBGRAPH_ID;

    if (!apiKey || !subgraphId) {
      throw new Error(
        "Missing SUBGRAPH_API_KEY or BSC_SUBGRAPH_ID environment variables.",
      );
    }

    const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;

    const graphqlQuery = `
      query {
        agents(first: 150, skip: 0) {
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
        }
      }
    `;

    console.log("[sync-search route] Fetching agents from subgraph...");
    console.log("[sync-search route] GraphQL Query:", graphqlQuery);
    console.log("[sync-search route] Subgraph Endpoint:", endpoint);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: graphqlQuery }),
    });
    console.log(
      "[sync-search route] Subgraph fetch completed with status:",
      res,
    );
    const json = await res.json();
    console.log("[sync-search route] Subgraph response:", {
      status: res.status,
      hasErrors: Boolean(json.errors),
      agentCount: Array.isArray(json.data?.agents)
        ? json.data.agents.length
        : 0,
    });
    console.log("[sync-search route] Subgraph response:", json);
    if (json.errors) {
      console.log("[sync-search route] Subgraph errors:", json.errors);
      return NextResponse.json({ error: json.errors }, { status: 400 });
    }

    const agents = json.data?.agents || [];
    console.log("[sync-search route] Starting sync for agents:", {
      count: agents.length,
    });

    const result = await syncAndAutoCategorizeAgents(agents);

    return NextResponse.json({
      success: true,
      processed: agents.length,
      indexed: result.updatedCount,
      skipped: result.skippedCount,
    });
  } catch (error: any) {
    console.log("[sync-search route] Error during sync:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
