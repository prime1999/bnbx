import { Agent, RawAgent } from "./types";

/**
 * Convert the raw Agent Registry object
 * into our application's Agent structure.
 */
export function normalizeAgent(raw: RawAgent): Agent | null {
  const registration = raw.registrationFile;

  /**
   * Some agents in the registry have no registration file.
   *
   * Those aren't very useful for our marketplace,
   * so we ignore them.
   */
  if (!registration) {
    return null;
  }

  /**
   * Ignore agents without meaningful information.
   */
  if (!registration.name && !registration.description) {
    return null;
  }

  return {
    id: raw.id,

    chainId: raw.chainId,

    agentId: raw.agentId,

    owner: raw.owner,

    name: registration.name?.trim() || `Agent ${raw.agentId}`,

    description:
      registration.description?.trim() || "No description available.",

    image: registration.image,

    supportedTrusts: registration.supportedTrusts ?? [],

    x402Support: registration.x402Support === true,

    totalFeedback: Number(raw.totalFeedback) || 0,

    createdAt: Number(raw.createdAt) || 0,
  };
}
