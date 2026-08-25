import { GoogleGenAI } from "@google/genai";
import { CategoryDescriptionsMap } from "./types";

// 1. Fixed API version configuration
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  apiVersion: "v1beta",
});

// 2. Fixed Model Name (Must be gemini-embedding-2)
const EMBEDDING_MODEL = "gemini-embedding-2";

let cachedCategoryVectors: Record<string, number[]> | null = null;

export const CATEGORY_DESCRIPTIONS: CategoryDescriptionsMap = {
  rebalancing:
    "Portfolio rebalancing agent: automatically rebalances crypto holdings to target weights, manages asset allocation drift, minimizes risk exposure, and keeps the portfolio aligned with strategy percentages.",
  grid_trading:
    "Grid trading agent: repeatedly places buy and sell limit orders within a configured price range to profit from range-bound volatility and automate market-making around target price bands.",
  yield_optimization:
    "Yield optimization agent: discovers and compares yield opportunities across DeFi protocols, reallocates capital between lending pools, LP positions, and staking vaults to maximize risk-adjusted returns.",
  health_factor_monitoring:
    "Health factor monitoring agent: watches collateral health ratios, alerts on liquidation risk, and triggers automated collateral top-ups or debt adjustments to keep lending positions safe.",
};

function normalizeList(val: unknown): string {
  if (Array.isArray(val)) return val.filter(Boolean).join(", ");
  if (typeof val === "string") return val;
  return "";
}

export function buildAgentEmbeddingText({
  name,
  description,
  a2aSkills,
  mcpTools,
  supportedTrusts,
}: {
  name?: string;
  description?: string;
  a2aSkills?: unknown;
  mcpTools?: unknown;
  supportedTrusts?: unknown;
}): string {
  const normalizedSkills = normalizeList(a2aSkills);
  const normalizedTools = normalizeList(mcpTools);
  const normalizedTrusts = normalizeList(supportedTrusts);

  return [
    `Agent name: ${name || "Unknown agent"}`,
    `Description: ${description || "No description provided."}`,
    `Skills: ${normalizedSkills || "general agent capabilities"}`,
    `Tools: ${normalizedTools || "no specific tools listed"}`,
    `Trust mechanisms: ${normalizedTrusts || "not specified"}`,
  ].join(". ");
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const KEYWORD_CATEGORY_MAP: Record<string, string[]> = {
  rebalancing: [
    "rebalance",
    "rebalancing",
    "portfolio",
    "allocation",
    "target allocation",
    "asset allocation",
    "risk exposure",
    "weights",
    "portfolio drift",
  ],
  grid_trading: [
    "grid",
    "grid trading",
    "limit order",
    "range trading",
    "buy sell",
    "price range",
    "volatility",
    "market making",
  ],
  yield_optimization: [
    "yield",
    "yield optimization",
    "staking",
    "lending",
    "liquidity pool",
    "lp",
    "vault",
    "apy",
    "depositor",
    "maximize returns",
    "reallocate capital",
  ],
  health_factor_monitoring: [
    "health factor",
    "health ratio",
    "liquidation",
    "collateral",
    "monitor",
    "risk alert",
    "aave",
    "top-up collateral",
    "debt adjustment",
  ],
};

export function classifyTextByKeywords(text: string): {
  category: string;
  confidence: number;
} {
  const normalized = text.toLowerCase();
  const scores: Record<string, number> = {};

  Object.entries(KEYWORD_CATEGORY_MAP).forEach(([category, keywords]) => {
    scores[category] = keywords.reduce((total, keyword) => {
      const value = normalized.includes(keyword.toLowerCase()) ? 1 : 0;
      return total + value;
    }, 0);
  });

  const bestCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (!bestCategory || bestCategory[1] === 0) {
    return { category: "general", confidence: 0 };
  }

  return {
    category: bestCategory[0],
    confidence: Number(Math.min(bestCategory[1] / 4, 1).toFixed(4)),
  };
}

/**
 * Initializes and caches reference vectors for canonical category descriptions.
 */
export async function getCategoryReferenceVectors(): Promise<
  Record<string, number[]>
> {
  try {
    if (cachedCategoryVectors) {
      console.log("[categories] Returning cached category vectors");
      return cachedCategoryVectors;
    }

    const categoryEntries = Object.entries(CATEGORY_DESCRIPTIONS);
    const categoryTexts = categoryEntries.map(
      ([category, desc]) => `${category.replace(/_/g, " ")}: ${desc}`,
    );

    console.log("[categories] Building category reference vectors in batch...");
    console.log("[categories] Batch payload:", {
      count: categoryTexts.length,
      categories: categoryEntries.map(([category]) => category),
    });

    const res = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: categoryTexts,
    });

    console.log("res: ", res);

    const rawRes = res as unknown as {
      embedding?: { values: number[] };
      embeddings?: Array<{ values: number[] }>;
    };

    const vectors =
      rawRes.embeddings ?? (rawRes.embedding ? [rawRes.embedding] : []);

    const categoryMap: Record<string, number[]> = {};

    categoryEntries.forEach(([category], index) => {
      const vector = vectors[index]?.values || [];
      categoryMap[category] = vector;

      console.log("[categories] Category vector built:", {
        category,
        vectorLength: vector.length,
      });
    });

    cachedCategoryVectors = categoryMap;
    console.log("[categories] Category vectors ready:", {
      categories: Object.keys(categoryMap),
      count: Object.keys(categoryMap).length,
    });
    return categoryMap;
  } catch (error) {
    console.error("[categories] Error generating category vectors:", error);
    return {};
  }
}

/**
 * Compares an agent vector against pre-computed category vectors
 * and returns the best matching category key.
 */
export function classifyAgentVector(
  agentVector: number[],
  categoryVectors: Record<string, number[]>,
): { category: string; confidence: number } {
  let bestCategory = "general";
  let highestScore = -1;
  const similarities: Record<string, number> = {};

  console.log("[categories] Starting classification for agent vector:", {
    vectorLength: agentVector.length,
    categoryCount: Object.keys(categoryVectors).length,
  });

  for (const [category, refVector] of Object.entries(categoryVectors)) {
    const similarity = cosineSimilarity(agentVector, refVector);
    similarities[category] = similarity;

    console.log("[categories] Similarity check:", {
      category,
      similarity: Number(similarity.toFixed(6)),
    });

    if (similarity > highestScore) {
      highestScore = similarity;
      bestCategory = category;
    }
  }

  console.log("[categories] Best similarity result:", {
    bestCategory,
    highestScore: Number(highestScore.toFixed(6)),
    similarities,
  });

  // Threshold check to fallback to general if weak match
  if (highestScore < 0.25) {
    console.log("[categories] Below threshold, falling back to general");
    return { category: "general", confidence: Number(highestScore.toFixed(4)) };
  }

  console.log("[categories] Selected category:", {
    category: bestCategory,
    confidence: Number(highestScore.toFixed(4)),
  });

  return {
    category: bestCategory,
    confidence: Number(highestScore.toFixed(4)),
  };
}
