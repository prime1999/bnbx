import type { AgentCategory, RawAgent } from "./types";

interface ClassificationResult {
  category: AgentCategory;
  confidenceScore: number;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

export function classifyAgent(agent: RawAgent): ClassificationResult {
  const name = normalizeText(agent.registrationFile?.name);

  const description = normalizeText(agent.registrationFile?.description);

  const text = `${name} ${description}`;

  const categories: {
    category: Exclude<AgentCategory, "general">;
    keywords: string[];
  }[] = [
    {
      category: "health_factor_monitoring",
      keywords: [
        "health factor",
        "liquidation",
        "liquidation risk",
        "lending",
        "borrow",
        "borrowing",
        "collateral",
        "aave",
        "loan",
      ],
    },

    {
      category: "yield_optimization",
      keywords: [
        "yield",
        "staking",
        "apr",
        "apy",
        "yield farming",
        "liquidity",
        "lp",
        "liquidity provider",
        "lending",
        "rewards",
      ],
    },

    {
      category: "grid_trading",
      keywords: [
        "grid trading",
        "grid",
        "trading bot",
        "automated trading",
        "order placement",
        "buy and sell",
        "trading",
      ],
    },

    {
      category: "rebalancing",
      keywords: [
        "rebalance",
        "rebalancing",
        "portfolio allocation",
        "asset allocation",
        "portfolio",
        "exposure",
      ],
    },
  ];

  let bestCategory: AgentCategory = "general";
  let bestScore = 0;

  for (const item of categories) {
    let matches = 0;

    for (const keyword of item.keywords) {
      if (text.includes(keyword)) {
        matches++;
      }
    }

    if (matches === 0) continue;

    const confidence = Math.min(0.5 + matches * 0.1, 0.98);

    if (confidence > bestScore) {
      bestScore = confidence;
      bestCategory = item.category;
    }
  }

  return {
    category: bestCategory,
    confidenceScore:
      bestCategory === "general" ? 0.2 : Number(bestScore.toFixed(2)),
  };
}
