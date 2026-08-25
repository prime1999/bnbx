import { GoogleGenAI } from "@google/genai";
import { getRankedAgentsPage, ProcessedAgent } from "@/lib/agents/orchestrator";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface UserIntent {
  rawQuery: string;
  targetCategory: string;
  riskTolerance: "conservative" | "moderate" | "aggressive" | "any";
  extractedKeywords: string[];
}

export interface SearchResultItem extends ProcessedAgent {
  relevanceScore: number;
}

export interface SearchResponse {
  query: string;
  intent: UserIntent;
  results: SearchResultItem[];
}

/**
 * Mathematical Cosine Similarity calculation between two vector arrays.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0)
    return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Utility to split array into chunks of a max size (to comply with Gemini's 100-item batch cap)
 */
function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Main Search Execution using Gemini gemini-embedding-001 vector search.
 */
export async function executeAgentSearch(params: {
  query: string;
  categoryFilter?: string;
}): Promise<SearchResponse> {
  const { query, categoryFilter } = params;
  const apiKey = process.env.SUBGRAPH_API_KEY;
  const subgraphId = process.env.BSC_SUBGRAPH_ID;
  const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;

  // Step 1: Fetch candidate pool from Graph Subgraph
  const basePage = await getRankedAgentsPage({
    page: 1,
    pageSize: 150,
    subgraphUrl: endpoint,
    category:
      categoryFilter && categoryFilter !== "all" ? categoryFilter : undefined,
  });

  const candidates: ProcessedAgent[] = basePage?.data || [];

  if (candidates.length === 0) {
    return {
      query,
      intent: {
        rawQuery: query,
        targetCategory: categoryFilter || "all",
        riskTolerance: "any",
        extractedKeywords: [],
      },
      results: [],
    };
  }

  try {
    // Step 2: Embed search query
    const queryEmbedResponse = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: query,
    });

    const rawQueryRes = queryEmbedResponse as unknown as {
      embeddings?: Array<{ values: number[] }>;
      embedding?: { values: number[] };
    };

    const queryVector =
      rawQueryRes.embeddings?.[0]?.values ||
      rawQueryRes.embedding?.values ||
      [];

    if (queryVector.length === 0) {
      throw new Error("Failed to extract query vector values from Gemini API.");
    }

    // Step 3: Prepare agent descriptions
    const candidateTexts = candidates.map((agent) => {
      const caps = Array.isArray(agent.capabilities)
        ? agent.capabilities.join(", ")
        : "";
      return `Agent: ${agent.name}. Category: ${agent.category}. Capabilities: ${caps}. Description: ${agent.description}`;
    });

    // Step 4: Chunk texts into max 80 items per request to stay under the 100-item limit
    const textChunks = chunkArray(candidateTexts, 80);

    const chunkResponses = await Promise.all(
      textChunks.map((chunk) =>
        ai.models.embedContent({
          model: "gemini-embedding-001",
          contents: chunk,
        }),
      ),
    );

    // Flatten all generated embeddings into one array
    const agentEmbeddings: Array<{ values: number[] }> = chunkResponses.flatMap(
      (res) => {
        const rawRes = res as unknown as {
          embeddings?: Array<{ values: number[] }>;
          embedding?: { values: number[] };
        };
        return (
          rawRes.embeddings || (rawRes.embedding ? [rawRes.embedding] : [])
        );
      },
    );

    // Step 5: Score and filter candidates against query vector
    const MINIMUM_SIMILARITY_THRESHOLD = 0.38;

    const searchResults: SearchResultItem[] = candidates
      .map((agent, index) => {
        const agentVector = agentEmbeddings[index]?.values;

        if (!agentVector || agentVector.length === 0) return null;

        const similarity = cosineSimilarity(queryVector, agentVector);

        // Filter out candidates below semantic relevance threshold
        if (similarity < MINIMUM_SIMILARITY_THRESHOLD) {
          return null;
        }

        // Normalize relevance score (0.38 - 1.0) into 0-100 integer range
        const semanticScore = Math.round(similarity * 100);
        const relevanceScore = Math.min(
          100,
          Math.round(semanticScore * 0.7 + (agent.qualityScore || 0) * 0.3),
        );

        return {
          ...agent,
          relevanceScore,
        };
      })
      .filter((item): item is SearchResultItem => item !== null)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      query,
      intent: {
        rawQuery: query,
        targetCategory: categoryFilter || "all",
        riskTolerance: "any",
        extractedKeywords: [],
      },
      results: searchResults,
    };
  } catch (error) {
    console.error("[Vector Search Execution Error]:", error);
    throw error;
  }
}
