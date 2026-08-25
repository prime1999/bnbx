import { calculateCompositeScore, RawAgent } from "./scoring";
import { classifyAgent, AgentCategory } from "./classify";

// 1. Declare & export the query at the very top of the file
export const GET_CANDIDATES_QUERY = `
  query GetAgentCandidates($first: Int!) {
    agents(
      first: $first
      orderBy: totalFeedback
      orderDirection: desc
    ) {
      id
      chainId
      agentId
      owner
      createdAt
      totalFeedback
      registrationFile {
        name
        description
        image
        mcpEndpoint
        mcpTools
        a2aEndpoint
        a2aSkills
        supportedTrusts
        x402Support
        ens
        did
      }
      feedback(where: { isRevoked: false }, first: 10) {
        tag1
        tag2
        clientAddress
        feedbackFile {
          text
        }
      }
      validations(first: 10) {
        validatorAddress
        response
        status
        tag
      }
    }
  }
`;

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
  pageSize?: number; // Strict 20 items per page
  subgraphUrl: string;
  onlyVerified?: boolean;
  category?: string;
  searchQuery?: string;
}

export async function getRankedAgentsPage(options: FetchOptions) {
  const {
    page = 1,
    pageSize = 20,
    subgraphUrl,
    onlyVerified = false,
    category = "all",
    searchQuery = "",
  } = options;

  const CANDIDATE_POOL_SIZE = 150;

  // 1. Fetch Candidate Pool using GET_CANDIDATES_QUERY
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GET_CANDIDATES_QUERY,
      variables: { first: CANDIDATE_POOL_SIZE },
    }),
  });

  const json = await response.json();
  const rawAgents: RawAgent[] = json.data?.agents || [];
  console.log("Raw agents:", rawAgents);

  // 2. Compute Multi-Factor Score & Verify
  let scoredCandidates = rawAgents.map((raw) => {
    const compositeScore = calculateCompositeScore(raw);
    const file = raw.registrationFile;

    const evidence: VerificationEvidence = {
      erc8004Verified: Boolean(raw.agentId && raw.agentId !== "0"),
      hasValidations: Boolean(
        raw.validations?.some(
          (v) =>
            v.status === "passed" || v.status === "1" || v.status === "success",
        ),
      ),
      hasTrustMechanisms: Boolean(
        file?.supportedTrusts && file.supportedTrusts.length > 0,
      ),
      x402Enabled: Boolean(file?.x402Support),
      hasENSorDID: Boolean(file?.ens || file?.did),
    };

    const isVerified =
      evidence.erc8004Verified &&
      (evidence.hasValidations ||
        evidence.hasTrustMechanisms ||
        evidence.hasENSorDID ||
        evidence.x402Enabled);

    return { raw, compositeScore, isVerified, evidence };
  });

  // 3. Search Filter
  if (searchQuery.trim().length > 0) {
    const query = searchQuery.toLowerCase().trim();
    scoredCandidates = scoredCandidates.filter(({ raw }) => {
      const file = raw.registrationFile;
      const name = (file?.name || "").toLowerCase();
      const description = (file?.description || "").toLowerCase();
      const tools = (file?.mcpTools || []).join(" ").toLowerCase();
      const skills = (file?.a2aSkills || []).join(" ").toLowerCase();
      const owner = (raw.owner || "").toLowerCase();
      const agentId = (raw.agentId || "").toLowerCase();

      return (
        name.includes(query) ||
        description.includes(query) ||
        tools.includes(query) ||
        skills.includes(query) ||
        owner.includes(query) ||
        agentId.includes(query)
      );
    });
  }

  // 4. Verified Toggle Filter
  if (onlyVerified) {
    scoredCandidates = scoredCandidates.filter((item) => item.isVerified);
  }

  // 5. Global Sort: Highest Score First
  scoredCandidates.sort((a, b) => b.compositeScore - a.compositeScore);

  // 6. Slice exact 20-item page window BEFORE Gemini classification
  const startIndex = (page - 1) * pageSize;
  const pageSlice = scoredCandidates.slice(startIndex, startIndex + pageSize);

  // 7. Classify ONLY the sliced 20 items (Saves Gemini API calls & latency)
  const processedPage = await Promise.all(
    pageSlice.map(async ({ raw, compositeScore, isVerified, evidence }) => {
      const file = raw.registrationFile;
      const classification = await classifyAgent(raw);

      const capabilities = [
        ...(file?.a2aSkills || []),
        ...(file?.mcpTools || []),
      ];

      const recentFeedback = (raw.feedback || [])
        .map((f) => f.feedbackFile?.text)
        .filter((t): t is string => Boolean(t));

      const processedAgent: ProcessedAgent = {
        id: raw.id,
        chainId: raw.chainId,
        agentId: raw.agentId,
        owner: raw.owner || "0x0000000000000000000000000000000000000000",
        name: file?.name || `Agent #${raw.agentId}`,
        description: file?.description || "No description provided.",
        image: file?.image,
        capabilities:
          capabilities.length > 0 ? capabilities : ["Autonomous Execution"],
        category: classification.category,
        confidenceScore: classification.confidenceScore,
        categorySimilarity: classification.categorySimilarity,
        verified: isVerified,
        verificationEvidence: evidence,
        trustScore: compositeScore,
        qualityScore: compositeScore,
        supportedTrusts: file?.supportedTrusts || [],
        x402Support: Boolean(file?.x402Support),
        ens: file?.ens,
        did: file?.did,
        mcpEndpoint: file?.mcpEndpoint,
        a2aEndpoint: file?.a2aEndpoint,
        totalFeedback: raw.totalFeedback || 0,
        recentFeedback,
      };

      return processedAgent;
    }),
  );

  // 8. Category Filter
  let finalData = processedPage;
  if (category && category !== "all") {
    finalData = processedPage.filter(
      (agent) => agent.category.toLowerCase() === category.toLowerCase(),
    );
  }

  return {
    data: finalData,
    totalCount: scoredCandidates.length,
    totalPages: Math.ceil(scoredCandidates.length / pageSize),
    currentPage: page,
  };
}
