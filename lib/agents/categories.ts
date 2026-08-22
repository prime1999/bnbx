import type { AgentCategory } from "./types";

export const CATEGORY_DESCRIPTIONS: Record<
  Exclude<AgentCategory, "general">,
  string
> = {
  rebalancing:
    "Agents that maintain or adjust portfolio allocations, asset weights, exposure, and target portfolio balances.",

  grid_trading:
    "Agents that automate trading using grid strategies, order placement, volatility capture, and repeated buy and sell orders.",

  yield_optimization:
    "Agents that find, optimize, compare, or automate opportunities for earning yield, staking rewards, liquidity provider returns, lending returns, and yield farming.",

  health_factor_monitoring:
    "Agents that monitor lending positions, health factors, liquidation risk, collateral ratios, borrowing positions, and protect users from liquidation.",
};
