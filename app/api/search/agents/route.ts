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

// Helper to normalize and combine name + description into a fingerprint
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
  const query = searchParams.get("q");
  const category = searchParams.get("category") || "all";
  const onlyVerified = searchParams.get("onlyVerified") === "true";

  console.log("[API /api/search/agents] Request received:", {
    hasQuery: Boolean(query),
    queryLength: query?.length || 0,
    category,
    onlyVerified,
  });

  if (!query) {
    console.log("[API /api/search/agents] Empty query; returning no results.");
    return NextResponse.json({ query: "", results: [] });
  }

  try {
    // 1. Generate 1 Query Vector using standard text-embedding model
    console.log("[API /api/search/agents] Generating query embedding...");
    const queryEmbedResponse = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: query,
    });

    const queryVector = queryEmbedResponse.embeddings?.[0]?.values || [];

    if (queryVector.length === 0) {
      throw new Error("Failed to generate query vector.");
    }

    console.log("[API /api/search/agents] Query embedding generated:", {
      dimensions: queryVector.length,
    });

    // 2. Vector match via Supabase pgvector RPC
    const { data: matchedAgents, error } = await supabase.rpc("match_agents", {
      query_embedding: queryVector,
      match_threshold: 0.35,
      match_count: 100, // Fetch top matches to deduplicate & recalculate
      filter_category: category,
    });

    if (error) throw error;

    console.log("[API /api/search/agents] Raw DB matches:", {
      count: matchedAgents?.length || 0,
    });

    // 3. Deduplicate by BOTH agent_id AND Content Fingerprint (Name + Description)
    const contentMap = new Map<string, any>();
    for (const row of matchedAgents || []) {
      // Use fingerprint to collapse entries with identical content
      const contentKey = getAgentFingerprint(row.name, row.description);

      if (!contentMap.has(contentKey)) {
        contentMap.set(contentKey, row);
      } else {
        const existing = contentMap.get(contentKey);
        // Keep the entry with the higher vector similarity match
        if ((row.similarity || 0) > (existing.similarity || 0)) {
          contentMap.set(contentKey, row);
        }
      }
    }

    const uniqueRows = Array.from(contentMap.values());

    // 4. Map DB records to RawAgent, recalculate composite score, and compute final relevance score
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

      // Recalculate 0-100 ERC-8004 Quality/Trust Score
      const trustScore = calculateCompositeScore(rawAgent);

      // Semantic Similarity Score (0-100)
      const semanticScore = Math.round((row.similarity || 0) * 100);

      // Weighted Relevance Score: 60% Vector Semantic Match + 40% Trust & Infrastructure Quality
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
        category: row.category || "general",
        confidenceScore: row.category_confidence || 1.0,
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

      return {
        processedAgent,
        relevanceScore,
        isVerified,
      };
    });

    // 5. Apply "Verified Only" filter if required
    if (onlyVerified) {
      scoredCandidates = scoredCandidates.filter((item) => item.isVerified);
    }

    // 6. Global Sorting: Rank strictly from HIGHEST relevance score to LOWEST
    scoredCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const finalResults = scoredCandidates.map((item) => ({
      ...item.processedAgent,
      relevanceScore: item.relevanceScore,
    }));

    console.log("[API /api/search/agents] Search response ready:", {
      resultCount: finalResults.length,
      category,
    });

    return NextResponse.json({ query, results: finalResults });
  } catch (err: any) {
    console.error("[Search Execution Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
