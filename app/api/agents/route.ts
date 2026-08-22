import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SUBGRAPH_API_KEY;
    const subgraphId = process.env.BSC_SUBGRAPH_ID;

    const searchParams = request.nextUrl.searchParams;

    const page = Number(searchParams.get("page") ?? 1);

    const limit = 20;

    const skip = (page - 1) * limit;

    const query = `
  query GetAgents {
    agents(
    first: ${limit}
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
    }
  }
`;

    if (!apiKey || !subgraphId) {
      return NextResponse.json(
        { error: "Agent registry configuration is missing" },
        { status: 500 },
      );
    }

    const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`The Graph request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error(result.errors);

      return NextResponse.json(
        { error: "Failed to query agent registry" },
        { status: 500 },
      );
    }

    console.log({ result, count: result.data?.agents?.length });

    return NextResponse.json({
      agents: result.data?.agents ?? [],
    });
  } catch (error) {
    console.error("Agent registry error:", error);

    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }
}
