export type AgentCategory =
  | "rebalancing"
  | "grid_trading"
  | "yield_optimization"
  | "health_factor_monitoring"
  | "general";

// Canonical descriptions dictionary type
export type CategoryDescriptionsMap = Record<
  Exclude<AgentCategory, "general">,
  string
>;

// Nested feedback record structure from Subgraph
export interface GraphFeedback {
  tag1?: string;
  tag2?: string;
  clientAddress: string;
  feedbackFile?: {
    text?: string;
  } | null;
}

// Nested validator attestation structure from Subgraph
export interface GraphValidation {
  validatorAddress: string;
  response?: string;
  status?: string;
  tag?: string;
}

// Nested registration file metadata strictly matching Subgraph schema
export interface GraphRegistrationFile {
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

// Raw Agent entity strictly matching your Subgraph documentation
export interface RawAgent {
  id: string; // e.g. "8453:0"
  chainId: number | string;
  agentId: string;
  owner: string;
  createdAt: string | number;
  totalFeedback?: number;
  registrationFile?: GraphRegistrationFile | null;
  feedback?: GraphFeedback[];
  validations?: GraphValidation[];
}

// Verification evidence map derived from actual schema fields
export interface VerificationEvidence {
  erc8004Verified: boolean; // Valid agentId & owner
  hasValidations: boolean; // Has passing validator attestations
  hasTrustMechanisms: boolean; // Has non-empty supportedTrusts array
  x402Enabled: boolean; // Has x402Support flag set to true
  hasENSorDID: boolean; // Has registered ENS name or Decentralized Identity
}

// Final Processed Agent structure for the frontend React Query client
export interface ProcessedAgent {
  id: string;
  chainId: number | string;
  agentId: string;
  owner: string;
  name: string;
  description: string;
  image?: string;
  capabilities: string[]; // Merged mcpTools and a2aSkills
  category:
    | "rebalancing"
    | "grid_trading"
    | "yield_optimization"
    | "health_factor_monitoring"
    | "general";
  confidenceScore: number;
  categorySimilarity: number;
  verified: boolean;
  verificationEvidence: VerificationEvidence;
  trustScore: number;
  qualityScore: number;
  supportedTrusts: string[];
  x402Support: boolean;
  ens?: string;
  did?: string;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  totalFeedback: number;
  recentFeedback: string[];
}

export interface VerificationEvidence {
  erc8004Verified: boolean;
  hasValidations: boolean;
  hasTrustMechanisms: boolean;
  x402Enabled: boolean;
  hasENSorDID: boolean;
}

export interface ProcessedAgent {
  id: string;
  chainId: number | string;
  agentId: string;
  owner: string;
  name: string;
  description: string;
  image?: string;
  capabilities: string[];
  category: AgentCategory;
  confidenceScore: number;
  categorySimilarity: number;
  verified: boolean;
  verificationEvidence: VerificationEvidence;
  trustScore: number;
  qualityScore: number;
  supportedTrusts: string[];
  x402Support: boolean;
  ens?: string;
  did?: string;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  totalFeedback: number;
  recentFeedback: string[];
}
