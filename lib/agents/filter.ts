import { RawAgent } from "./types";

// Filters out corrupt, incomplete, duplicate, or spam agents retrieved from The Graph
export function filterAgents(rawAgents: RawAgent[]): RawAgent[] {
  const seenAgentIds = new Set<string>();

  return rawAgents.filter((agent) => {
    // Exclude records missing critical agent identity
    if (!agent || !agent.agentId) return false;

    // Deduplicate repeated agent entries using agent ID
    if (seenAgentIds.has(agent.agentId)) return false;
    seenAgentIds.add(agent.agentId);

    // Filter out obvious spam or placeholder registration descriptions
    const name = agent.registrationFile?.name?.toLowerCase() || "";
    const description =
      agent.registrationFile?.description?.toLowerCase() || "";

    if (name.includes("test agent") || name.includes("asdf") || name.length < 2)
      return false;
    if (description.includes("test description") || description.length < 5)
      return false;

    // Retain clean agent record
    return true;
  });
}
