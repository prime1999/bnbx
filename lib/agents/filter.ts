import type { RawAgent } from "./types";

export function filterAgents(agents: RawAgent[]): RawAgent[] {
  const seen = new Set<string>();

  return agents.filter((agent) => {
    /*
     * Remove duplicate agents.
     */
    if (seen.has(agent.id)) {
      return false;
    }

    seen.add(agent.id);

    /*
     * Remove agents without registration data.
     */
    if (!agent.registrationFile) {
      return false;
    }

    /*
     * Remove agents without a name.
     */
    if (!agent.registrationFile.name?.trim()) {
      return false;
    }

    /*
     * Remove obvious spam/noise.
     */
    const name = agent.registrationFile.name.toLowerCase();

    const description = agent.registrationFile.description?.toLowerCase() ?? "";

    /*
     * Detect repeated garbage text.
     */
    const combined = `${name} ${description}`;

    const uniqueCharacters = new Set(combined.replace(/\s/g, "").split(""))
      .size;

    if (combined.length > 20 && uniqueCharacters < 8) {
      return false;
    }

    return true;
  });
}
