import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { calculateCompositeScore, RawAgent } from "@/lib/agents/scoring";
import { ProcessedAgent, VerificationEvidence } from "@/lib/agents/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Safe Array Normalization Helper
function safeParseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val ? [val] : [];
    }
  }
  return [];
}

// Content Fingerprinting Helper for Duplicate Detection
function getAgentFingerprint(
  name: string = "",
  description: string = "",
): string {
  const cleanName = name.trim().toLowerCase().replace(/\s+/g, " ");
  const cleanDesc = description.trim().toLowerCase().replace(/\s+/g, " ");
  return `${cleanName}::${cleanDesc}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const onlyVerified = searchParams.get("verified") === "true";
  const category = searchParams.get("category") || "all";
  const searchQuery = searchParams.get("search") || "";

  try {
    let matchedAgents: any[] = [];

    // 1. Determine Search Context (Combined Search Query + Category Vector Match)
    const effectiveSearchText = [
      category !== "all" ? `${category} agent category` : "",
      searchQuery.trim(),
    ]
      .filter(Boolean)
      .join(" ");

    if (effectiveSearchText.length > 0) {
      // Generate Embedding for Category / Query Text
      console.log(
        `[API /api/agents] Generating vector embedding for context: "${effectiveSearchText}"`,
      );
      const embedResponse = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: effectiveSearchText,
      });

      const queryVector = embedResponse.embeddings?.[0]?.values || [];

      if (queryVector.length === 0) {
        throw new Error("Failed to generate category/search vector.");
      }

      // Query vector matches using Supabase pgvector RPC
      const { data: rpcMatches, error: rpcError } = await supabase.rpc(
        "match_agents",
        {
          query_embedding: queryVector,
          match_threshold: 0.25,
          match_count: 150,
          filter_category: "all", // Ignore stored database category string
        },
      );

      if (rpcError) throw rpcError;
      matchedAgents = rpcMatches || [];
    } else {
      // Fallback: Fetch raw agents if no category or search filter was passed
      const { data: rawData, error: dbError } = await supabase
        .from("agent_search_index")
        .select("*");

      if (dbError) throw dbError;
      matchedAgents = rawData || [];
    }

    // 2. Content-Based Deduplication (Name + Description Fingerprinting & Vector Match Tie-Breaking)
    const contentMap = new Map<string, any>();

    for (const row of matchedAgents) {
      const contentKey = getAgentFingerprint(row.name, row.description);

      if (!contentMap.has(contentKey)) {
        contentMap.set(contentKey, row);
      } else {
        const existing = contentMap.get(contentKey);
        // Tie-breaker: Retain the duplicate with higher vector similarity match
        if ((row.similarity || 0) > (existing.similarity || 0)) {
          contentMap.set(contentKey, row);
        }
      }
    }

    const uniqueRows = Array.from(contentMap.values());

    // 3. Map to RawAgent, Dynamic Score Recalculation & Verification Evidence
    let scoredCandidates = uniqueRows.map((row) => {
      const mcpTools = safeParseArray(row.mcp_tools);
      const a2aSkills = safeParseArray(row.a2a_skills);
      const supportedTrusts = safeParseArray(row.supported_trusts);

      const rawAgent: RawAgent = {
        id: row.agent_id,
        chainId: row.chain_id,
        agentId: row.agent_id,
        owner: row.owner || "0x0000000000000000000000000000000000000000",
        createdAt: row.created_at || row.updated_at || Date.now(),
        totalFeedback: row.total_feedback || 0,
        registrationFile: {
          name: row.name,
          description: row.description,
          image: row.image,
          mcpEndpoint: row.mcp_endpoint,
          mcpTools,
          a2aEndpoint: row.a2a_endpoint,
          a2aSkills,
          supportedTrusts,
          x402Support: row.x402_support,
          ens: row.ens,
          did: row.did,
        },
        validations: [],
        feedback: [],
      };

      // Recalculate Dynamic Composite Quality Score (0-100)
      const trustScore = calculateCompositeScore(rawAgent);

      // Semantic Similarity Score (0-100)
      const semanticScore = Math.round((row.similarity || 1.0) * 100);

      // Relevance Rank: 60% Category/Vector Semantic Match + 40% Trust Score
      const relevanceScore = Math.min(
        100,
        Math.round(semanticScore * 0.6 + trustScore * 0.4),
      );

      const evidence: VerificationEvidence = {
        erc8004Verified: Boolean(row.agent_id && row.agent_id !== "0"),
        hasValidations: row.total_feedback > 0,
        hasTrustMechanisms: supportedTrusts.length > 0,
        x402Enabled: Boolean(row.x402_support),
        hasENSorDID: Boolean(row.ens || row.did),
      };

      const isVerified =
        evidence.erc8004Verified &&
        (evidence.hasValidations ||
          evidence.hasTrustMechanisms ||
          evidence.hasENSorDID ||
          evidence.x402Enabled);

      const capabilities = [...a2aSkills, ...mcpTools];

      const processedAgent: ProcessedAgent = {
        id: row.agent_id,
        chainId: row.chain_id,
        agentId: row.agent_id,
        owner: row.owner || "0x0000000000000000000000000000000000000000",
        name: row.name || `Agent #${row.agent_id}`,
        description: row.description || "No description provided.",
        image: row.image,
        capabilities:
          capabilities.length > 0 ? capabilities : ["Autonomous Execution"],
        category: category !== "all" ? category : row.category || "general",
        confidenceScore: row.similarity || 1.0,
        categorySimilarity: row.similarity || 1.0,
        verified: isVerified,
        verificationEvidence: evidence,
        trustScore,
        qualityScore: trustScore,
        supportedTrusts,
        x402Support: Boolean(row.x402_support),
        ens: row.ens,
        did: row.did,
        mcpEndpoint: row.mcp_endpoint,
        a2aEndpoint: row.a2a_endpoint,
        totalFeedback: row.total_feedback || 0,
        recentFeedback: [],
      };

      return { processedAgent, relevanceScore, isVerified };
    });

    // 4. Apply Verification Filter
    if (onlyVerified) {
      scoredCandidates = scoredCandidates.filter((item) => item.isVerified);
    }

    // 5. Global Sorting: Highest relevance/similarity score to lowest
    scoredCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 6. Pagination Slicing
    const totalCount = scoredCandidates.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedAgents = scoredCandidates
      .slice(startIndex, startIndex + pageSize)
      .map((item) => item.processedAgent);

    return NextResponse.json({
      data: paginatedAgents,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
    });
  } catch (error: any) {
    console.error("Failed to fetch ranked agent page:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
