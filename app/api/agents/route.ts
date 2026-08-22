import { NextRequest, NextResponse } from "next/server";

import { filterAgents } from "@/lib/agents/filter";
import { classifyAgent } from "@/lib/agents/classify";
import { verifyAgent } from "@/lib/agents/verify";
import { scoreAgent } from "@/lib/agents/score";
import type { RawAgent } from "@/lib/agents/types";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SUBGRAPH_API_KEY;
    const subgraphId = process.env.BSC_SUBGRAPH_ID;

    console.log("[agents] Request started", {
      path: request.nextUrl.pathname,
      page: request.nextUrl.searchParams.get("page") ?? "1",
      category: request.nextUrl.searchParams.get("category"),
      hasApiKey: Boolean(apiKey),
      hasSubgraphId: Boolean(subgraphId),
    });

    /*
     * -----------------------------------------
     * 1. Validate configuration
     * -----------------------------------------
     */

    if (!apiKey || !subgraphId) {
      console.error("[agents] Missing registry configuration");
      return NextResponse.json(
        {
          error: "Agent registry configuration is missing",
        },
        { status: 500 },
      );
    }

    /*
     * -----------------------------------------
     * 2. Read pagination/category parameters
     * -----------------------------------------
     */

    const searchParams = request.nextUrl.searchParams;

    const pageParam = Number(searchParams.get("page") ?? "1");

    const page =
      Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

    const category = searchParams.get("category");

    const limit = 20;

    const skip = (page - 1) * limit;

    console.log("[agents] Parsed request parameters", {
      page,
      category,
      limit,
      skip,
    });

    /*
     * -----------------------------------------
     * 3. Query BNB Agent Registry
     * -----------------------------------------
     */

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

    const endpoint =
      `https://gateway.thegraph.com/api/${apiKey}` +
      `/subgraphs/id/${subgraphId}`;

    const response = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        query,
      }),

      /*
       * Don't let Next.js serve an old registry snapshot
       * forever.
       */
      next: {
        revalidate: 60,
      },
    });

    console.log("[agents] Registry response received", {
      status: response.status,
      ok: response.ok,
      page,
      skip,
    });

    if (!response.ok) {
      console.error("[agents] Registry request failed", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`The Graph request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error("The Graph errors:", result.errors);

      return NextResponse.json(
        {
          error: "Failed to query agent registry",
        },
        { status: 500 },
      );
    }

    /*
     * -----------------------------------------
     * 4. Get raw agents
     * -----------------------------------------
     */

    const rawAgents: RawAgent[] = result.data?.agents ?? [];

    console.log("[agents] Raw agents loaded", {
      count: rawAgents.length,
      page,
    });

    /*
     * -----------------------------------------
     * 5. Remove duplicates/noise
     * -----------------------------------------
     */

    const cleanAgents = filterAgents(rawAgents);

    console.log("[agents] Agents filtered", {
      rawCount: rawAgents.length,
      cleanCount: cleanAgents.length,
      removedCount: rawAgents.length - cleanAgents.length,
    });

    /*
     * -----------------------------------------
     * 6. ANALYZE EVERY AGENT
     *
     * Every agent gets:
     *
     * - category
     * - confidenceScore
     * - verified
     * - score
     * -----------------------------------------
     */

    const processedAgents = cleanAgents.map((agent) => {
      /*
       * Determine category + confidence.
       */
      const classification = classifyAgent(agent);

      /*
       * Determine verification status.
       */
      const verified = verifyAgent(agent);

      /*
       * Calculate overall marketplace score.
       */
      const score = scoreAgent({
        agent,
        verified,
      });

      return {
        ...agent,

        category: classification.category,

        confidenceScore: classification.confidenceScore,

        verified,

        score,
      };
    });

    console.log("[agents] Agents analyzed", {
      count: processedAgents.length,
      verifiedCount: processedAgents.filter((agent) => agent.verified).length,
    });

    /*
     * -----------------------------------------
     * 7. Category filtering
     *
     * Classification already happened above.
     *
     * So even when category isn't provided,
     * every agent still has its category,
     * confidenceScore, verified and score.
     * -----------------------------------------
     */

    const agents = category
      ? processedAgents.filter((agent) => agent.category === category)
      : processedAgents;

    console.log("[agents] Category filter applied", {
      requestedCategory: category,
      analyzedCount: processedAgents.length,
      returnedBeforeSort: agents.length,
    });

    /*
     * -----------------------------------------
     * 8. Rank highest quality first
     * -----------------------------------------
     */

    agents.sort((a, b) => b.score - a.score);

    console.log("[agents] Response ready", {
      page,
      category,
      returnedCount: agents.length,
      topAgentId: agents[0]?.id ?? null,
      topAgentScore: agents[0]?.score ?? null,
    });

    /*
     * -----------------------------------------
     * 9. Return response
     * -----------------------------------------
     */

    return NextResponse.json({
      agents,

      pagination: {
        page,
        limit,

        returned: agents.length,
      },
    });
  } catch (error) {
    console.error("[agents] Request failed", error);

    return NextResponse.json(
      {
        error: "Failed to fetch agents",
      },
      { status: 500 },
    );
  }
}
