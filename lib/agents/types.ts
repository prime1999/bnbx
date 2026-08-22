export type AgentCategory =
  | "rebalancing"
  | "grid_trading"
  | "yield_optimization"
  | "health_factor_monitoring"
  | "general";

export type TrustSignal = "reputation" | "crypto-economic" | "tee-attestation";

export interface RawAgent {
  id: string;
  chainId: string;
  agentId: string;
  owner: string;
  createdAt: string;
  totalFeedback: string;

  registrationFile: {
    name: string | null;
    description: string | null;
    image: string | null;
    mcpEndpoint: string | null;
    mcpTools: string[];
    a2aEndpoint: string | null;
    a2aSkills: string[];
    supportedTrusts: TrustSignal[];
    x402Support: boolean | null;
    ens: string | null;
    did: string | null;
  } | null;

  stakingPool?: {
    stakedBalanceRaw: string;
    tokenAddress: string;
    isSlashed: boolean;
  } | null;
}

export interface ProcessedAgent extends RawAgent {
  category: AgentCategory;

  /**
   * How confident our system is that the
   * agent belongs to the assigned category.
   *
   * 0 = no confidence
   * 1 = completely confident
   */
  confidenceScore: number;

  /**
   * Whether the agent passed our verification
   * requirements.
   */
  verified: boolean;

  /**
   * Overall marketplace quality/trust score.
   */
  score: number;
}
