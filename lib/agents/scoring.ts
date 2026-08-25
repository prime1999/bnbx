// Raw entity definitions mapping to your GetAgent/GetAgents Subgraph schema
export interface SubgraphRegistrationFile {
  name?: string;
  description?: string;
  image?: string;
  mcpEndpoint?: string;
  mcpTools?: string[];
  a2aEndpoint?: string;
  a2aSkills?: string[];
  supportedTrusts?: string[];
  x402Support?: boolean;
  ens?: string;
  did?: string;
}

export interface SubgraphFeedback {
  tag1?: string;
  tag2?: string;
  clientAddress: string;
  feedbackFile?: {
    text?: string;
  } | null;
}

export interface SubgraphValidation {
  validatorAddress: string;
  response?: string;
  status?: string;
  tag?: string;
}

export interface RawAgent {
  id: string; // e.g. "8453:1247"
  chainId: number | string;
  agentId: string;
  owner: string;
  createdAt: string | number;
  totalFeedback?: number;
  registrationFile?: SubgraphRegistrationFile | null;
  feedback?: SubgraphFeedback[];
  validations?: SubgraphValidation[];
}

/**
 * Calculates a 0-100 Multi-Factor Quality Score based on ERC-8004 spec signals:
 * - Pillar 1: Identity & Security (Max 40 points)
 * - Pillar 2: Capability & Infrastructure (Max 30 points)
 * - Pillar 3: Track Record & Social (Max 30 points)
 */
export function calculateCompositeScore(agent: RawAgent): number {
  const file = agent.registrationFile;
  let score = 0;

  // --- Pillar 1: Identity & Security Verification (Max 40 pts) ---
  if (file?.ens || file?.did) {
    score += 10;
  }
  if (file?.supportedTrusts && file.supportedTrusts.length > 0) {
    score += 15;
  }

  const hasPassedValidations = agent.validations?.some(
    (v) => v.status === "passed" || v.status === "1" || v.status === "success",
  );
  if (hasPassedValidations) {
    score += 15;
  }

  // --- Pillar 2: Capability & Infrastructure (Max 30 pts) ---
  if (file?.mcpEndpoint || file?.a2aEndpoint) {
    score += 10;
  }
  if (file?.x402Support) {
    score += 10;
  }

  const totalCapabilities =
    (file?.mcpTools?.length || 0) + (file?.a2aSkills?.length || 0);
  if (totalCapabilities > 0) {
    score += Math.min(10, totalCapabilities * 2);
  }

  // --- Pillar 3: Track Record & Client Feedback (Max 30 pts) ---
  const validFeedbackCount = agent.feedback?.length || 0;
  const recentReviewsBonus = Math.min(20, validFeedbackCount * 4);
  const totalContractFeedbackBonus = Math.min(
    10,
    (agent.totalFeedback || 0) * 1,
  );

  score += recentReviewsBonus + totalContractFeedbackBonus;

  return Math.min(100, Math.max(0, score));
}
