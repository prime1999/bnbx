import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category") || "all";

  console.log("[API /api/search/agents] Request received:", {
    hasQuery: Boolean(query),
    queryLength: query?.length || 0,
    category,
  });

  if (!query) {
    console.log("[API /api/search/agents] Empty query; returning no results.");
    return NextResponse.json({ results: [] });
  }

  try {
    // 1. Generate 1 Query Vector
    console.log("[API /api/search/agents] Generating query embedding...");
    const queryEmbedResponse = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: query,
    });

    const rawRes = queryEmbedResponse as unknown as {
      embeddings?: Array<{ values: number[] }>;
      embedding?: { values: number[] };
    };

    const queryVector =
      rawRes.embeddings?.[0]?.values || rawRes.embedding?.values || [];

    if (queryVector.length === 0) {
      throw new Error("Failed to generate query vector.");
    }

    console.log("[API /api/search/agents] Query embedding generated:", {
      dimensions: queryVector.length,
    });

    // 2. Local database vector match via pgvector RPC
    console.log("[API /api/search/agents] Matching agents via Supabase RPC:", {
      category,
      matchThreshold: 0.38,
      matchCount: 50,
    });
    const { data: matchedAgents, error } = await supabase.rpc("match_agents", {
      query_embedding: queryVector,
      match_threshold: 0.38,
      match_count: 50,
      filter_category: category,
    });

    if (error) throw error;

    console.log("[API /api/search/agents] Agents matched:", {
      count: matchedAgents?.length || 0,
    });

    // 3. Compute relevance score combining similarity + quality score
    const results = (matchedAgents || []).map((agent: any) => {
      const semanticScore = Math.round(agent.similarity * 100);
      const relevanceScore = Math.min(
        100,
        Math.round(semanticScore * 0.7 + (agent.quality_score || 0) * 0.3),
      );

      return {
        id: agent.agent_id,
        name: agent.name,
        category: agent.category,
        description: agent.description,
        relevanceScore,
      };
    });

    console.log("[API /api/search/agents] Search response ready:", {
      resultCount: results.length,
      category,
    });

    return NextResponse.json({ query, results });
  } catch (err: any) {
    console.error("[Search Execution Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
