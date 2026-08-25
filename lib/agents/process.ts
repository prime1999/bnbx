import { classifyAgent } from "./classify";

import { filterAgents } from "./filter";
import { calculateQualityScore } from "./quality-score";
import { ProcessedAgent, RawAgent } from "./types";
import { calculateTrustScore } from "./trust-score";
import { verifyAgent } from "./verify";

export async function processAgents(
  rawAgents: RawAgent[],
): Promise<ProcessedAgent[]> {
  const cleanAgents = filterAgents(rawAgents);

  return Promise.all(
    cleanAgents.map(async (agent) => {
      const file = agent.registrationFile;

      const classification = await classifyAgent(agent);
      const verification = verifyAgent(agent);
      const trustScore = calculateTrustScore(agent, verification.evidence);
      const qualityScore = calculateQualityScore({
        trustScore,
        confidenceScore: classification.confidenceScore,
        verified: verification.verified,
      });

      // Merge capabilities array from mcpTools and a2aSkills
      const capabilities = [
        ...(file?.a2aSkills || []),
        ...(file?.mcpTools || []),
      ];

      // Extract text snippets from feedback array
      const recentFeedback = (agent.feedback || [])
        .map((f) => f.feedbackFile?.text)
        .filter((text): text is string => Boolean(text));

      const processedAgent: ProcessedAgent = {
        id: agent.id,
        chainId: agent.chainId,
        agentId: agent.agentId,
        owner: agent.owner || "0x0000000000000000000000000000000000000000",
        name: file?.name || `Agent #${agent.agentId}`,
        description: file?.description || "No description provided.",
        image: file?.image,
        capabilities:
          capabilities.length > 0 ? capabilities : ["Autonomous Execution"],
        category: classification.category,
        confidenceScore: classification.confidenceScore,
        categorySimilarity: classification.categorySimilarity,
        verified: verification.verified,
        verificationEvidence: verification.evidence,
        trustScore,
        qualityScore,
        supportedTrusts: file?.supportedTrusts || [],
        x402Support: Boolean(file?.x402Support),
        ens: file?.ens,
        did: file?.did,
        mcpEndpoint: file?.mcpEndpoint,
        a2aEndpoint: file?.a2aEndpoint,
        totalFeedback: agent.totalFeedback || 0,
        recentFeedback,
      };

      return processedAgent;
    }),
  );
}
