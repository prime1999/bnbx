import { ProcessedAgent, StructuredIntent } from "../agents/types";

// Generates human-readable match explanations justifying agent recommendation
export function generateMatchReasons(
  agent: ProcessedAgent,
  intent: StructuredIntent,
): string[] {
  const reasons: string[] = [];

  // Check asset alignment
  const matchesAsset = intent.assets.some(
    (asset) =>
      agent.description.toLowerCase().includes(asset.toLowerCase()) ||
      agent.name.toLowerCase().includes(asset.toLowerCase()),
  );
  if (matchesAsset) {
    reasons.push(`Supports target asset (${intent.assets.join(", ")})`);
  }

  // Check category match
  if (
    intent.targetCategory !== "general" &&
    agent.category === intent.targetCategory
  ) {
    reasons.push(
      `Direct category match for ${intent.targetCategory.replace("_", " ")}`,
    );
  }

  // Highlight identity verification state
  if (agent.verified) {
    reasons.push("Verified ERC-8004 Identity & Security Proofs");
  }

  // Highlight trust ratings
  if (agent.trustScore >= 70) {
    reasons.push(`High Trust Rating (${agent.trustScore}/100)`);
  }

  // Highlight protocol capability match
  if (agent.protocols.length > 0) {
    reasons.push(`Integrated with ${agent.protocols.slice(0, 2).join(", ")}`);
  }

  // Provide fallback reason if list is empty
  if (reasons.length === 0) {
    reasons.push("Matches general search query context");
  }

  return reasons;
}
