import { cosineSimilarity } from "../agents/classify";
import { generateEmbedding } from "../agents/embeddings";
import { buildSemanticAgentDocument } from "../agents/profile";
import {
  ProcessedAgent,
  SearchMatchResult,
  StructuredIntent,
} from "../agents/types";
import { generateMatchReasons } from "./explain";

// Multi-signal in-memory ranking engine combining vector match, category match, and trust
export async function rankAgentsForQuery(params: {
  userQuery: string;
  intent: StructuredIntent;
  agents: ProcessedAgent[];
  categoryFilter?: string;
}): Promise<SearchMatchResult[]> {
  const { userQuery, intent, agents, categoryFilter } = params;

  // Generate vector embedding for original user request string
  const queryVector = await generateEmbedding(userQuery);

  // Filter or score each agent in-memory
  const rankedResults = await Promise.all(
    agents.map(async (agent) => {
      // Build document text and generate vector embedding for agent
      const agentDoc = buildSemanticAgentDocument({
        id: agent.id,
        agentId: agent.agentId,
        owner: agent.owner,
        registrationFile: {
          name: agent.name,
          description: agent.description,
          capabilities: agent.capabilities,
          protocols: agent.protocols,
        },
      });

      const agentVector = await generateEmbedding(agentDoc);

      // Compute vector similarity score between user query vector and agent vector
      const semanticSimilarity = cosineSimilarity(queryVector, agentVector); // 0.00 to 1.00

      // Calculate category alignment boost
      const isTargetCategory = agent.category === intent.targetCategory;
      const categoryScore = isTargetCategory ? agent.confidenceScore : 0.2;

      // Normalize trust and quality ratings to 0.00 - 1.00 scale
      const trustScoreNormalized = agent.trustScore / 100;
      const qualityScoreNormalized = agent.qualityScore / 100;
      const verificationBonus = agent.verified ? 1.0 : 0.0;

      // Compute weighted composite match score
      // Weight breakdown: 40% Semantic Match, 20% Category, 15% Trust, 15% Verification, 10% Quality
      const rawMatchScore =
        semanticSimilarity * 0.4 +
        categoryScore * 0.2 +
        trustScoreNormalized * 0.15 +
        verificationBonus * 0.15 +
        qualityScoreNormalized * 0.1;

      // Convert score to percentage float (0 to 100)
      const matchScore = Math.min(100, Math.round(rawMatchScore * 100));

      // Generate human-readable reasons explaining match
      const matchReasons = generateMatchReasons(agent, intent);

      return {
        agent,
        matchScore,
        matchReasons,
      };
    }),
  );

  // Apply vector category filter if explicitly requested from UI dropdown
  let filteredResults = rankedResults;
  if (categoryFilter && categoryFilter !== "all") {
    filteredResults = rankedResults.filter(
      (item) =>
        item.agent.category === categoryFilter ||
        item.agent.categorySimilarity >= 0.65, // Allow vector matches above 65% similarity
    );
  }

  // Sort candidates by matchScore descending
  return filteredResults.sort((a, b) => b.matchScore - a.matchScore);
}
