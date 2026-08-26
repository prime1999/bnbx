import { createClient } from "@supabase/supabase-js";
import { RawAgent, calculateCompositeScore } from "./scoring";
import { AgentCategory } from "./classify";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

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

export interface FetchOptions {
  page: number; // 1-indexed (1, 2, 3...)
  pageSize?: number; // Default 20
  subgraphUrl?: string; // Optional/Deprecated fallback
  onlyVerified?: boolean;
  category?: string;
  searchQuery?: string;
}

export async function getRankedAgentsPage(options: FetchOptions) {
  const {
    page = 1,
    pageSize = 20,
    onlyVerified = false,
    category = "all",
    searchQuery = "",
  } = options;

  // 1. Build Base Supabase Query
  let queryBuilder = supabase
    .from("agent_search_index")
    .select("*", { count: "exact" });

  // 2. Apply Category Filter
  if (category && category !== "all") {
    // Matches either 'category' or 'inferred_category' column in Supabase
    queryBuilder = queryBuilder.or(
      `category.eq.${category},inferred_category.eq.${category}`,
    );
  }

  // 3. Apply Text Search Filter across Name, Description, Tools, and Skills
  if (searchQuery.trim().length > 0) {
    const term = `%${searchQuery.trim().toLowerCase()}%`;
    queryBuilder = queryBuilder.or(
      `name.ilike.${term},description.ilike.${term},mcp_tools.ilike.${term},a2a_skills.ilike.${term},owner.ilike.${term},agent_id.ilike.${term}`,
    );
  }

  // Fetch all candidate records for scoring and verification filtering
  const { data: dbAgents, error, count } = await queryBuilder;

  if (error) {
    console.error("[Supabase Fetch Error]:", error);
    return { data: [], totalCount: 0, totalPages: 0, currentPage: page };
  }

  // 4. Transform DB rows, Compute Multi-Factor Scores & Verification
  let scoredCandidates = (dbAgents || []).map((row) => {
    const mcpTools: string[] = Array.isArray(row.mcp_tools)
      ? row.mcp_tools
      : typeof row.mcp_tools === "string"
        ? JSON.parse(row.mcp_tools || "[]")
        : [];

    const a2aSkills: string[] = Array.isArray(row.a2a_skills)
      ? row.a2a_skills
      : typeof row.a2a_skills === "string"
        ? JSON.parse(row.a2a_skills || "[]")
        : [];

    const supportedTrusts: string[] = Array.isArray(row.supported_trusts)
      ? row.supported_trusts
      : typeof row.supported_trusts === "string"
        ? JSON.parse(row.supported_trusts || "[]")
        : [];

    // Reconstruct RawAgent shape for calculateCompositeScore
    const rawAgent: RawAgent = {
      id: row.agent_id,
      chainId: row.chain_id,
      agentId: row.agent_id,
      owner: row.owner,
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
    };

    const compositeScore = calculateCompositeScore(rawAgent);

    const evidence: VerificationEvidence = {
      erc8004Verified: Boolean(row.agent_id && row.agent_id !== "0"),
      hasValidations: row.total_feedback > 0, // Primary trust check
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
      category: (row.inferred_category ||
        row.category ||
        "general") as AgentCategory,
      confidenceScore: row.category_confidence || 1.0,
      categorySimilarity: row.category_confidence || 1.0,
      verified: isVerified,
      verificationEvidence: evidence,
      trustScore: compositeScore,
      qualityScore: compositeScore,
      supportedTrusts,
      x402Support: Boolean(row.x402_support),
      ens: row.ens,
      did: row.did,
      mcpEndpoint: row.mcp_endpoint,
      a2aEndpoint: row.a2a_endpoint,
      totalFeedback: row.total_feedback || 0,
      recentFeedback: [],
    };

    return { processedAgent, compositeScore, isVerified };
  });

  // 5. Apply "Verified Only" Filter if enabled
  if (onlyVerified) {
    scoredCandidates = scoredCandidates.filter((item) => item.isVerified);
  }

  // 6. Global Sort: Highest Multi-Factor Composite Score First
  scoredCandidates.sort((a, b) => b.compositeScore - a.compositeScore);

  // 7. Paginate Window
  const startIndex = (page - 1) * pageSize;
  const paginatedAgents = scoredCandidates
    .slice(startIndex, startIndex + pageSize)
    .map((item) => item.processedAgent);

  const totalFilteredCount = scoredCandidates.length;

  return {
    data: paginatedAgents,
    totalCount: totalFilteredCount,
    totalPages: Math.ceil(totalFilteredCount / pageSize),
    currentPage: page,
  };
}
