import { NextResponse } from "next/server";
import { getRankedAgentsPage } from "@/lib/agents/orchestrator";

const apiKey = process.env.SUBGRAPH_API_KEY;
const subgraphId = process.env.BSC_SUBGRAPH_ID;

const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const onlyVerified = searchParams.get("verified") === "true";
  const category = searchParams.get("category") || "all";
  const searchQuery = searchParams.get("search") || "";

  try {
    const result = await getRankedAgentsPage({
      page,
      pageSize: 20,
      subgraphUrl: endpoint,
      onlyVerified,
      category,
      searchQuery,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch ranked agent page:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
