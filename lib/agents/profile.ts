import { RawAgent } from "./types";

// Combines actual Subgraph metadata into a dense textual document for Gemini embeddings
export function buildSemanticAgentDocument(agent: RawAgent): string {
  const file = agent.registrationFile;

  const name = file?.name || `Agent #${agent.agentId}`;
  const description = file?.description || "No description provided.";

  // Merge A2A skills and MCP tools into unified capability capabilities string
  const skills = file?.a2aSkills?.join(", ") || "";
  const tools = file?.mcpTools?.join(", ") || "";
  const capabilities =
    [skills, tools].filter(Boolean).join(", ") || "Autonomous Execution";

  const trusts = file?.supportedTrusts?.join(", ") || "None specified";
  const identity =
    [file?.ens, file?.did].filter(Boolean).join(" / ") || "Standard Wallet";

  return `
Agent Name: ${name}
Agent Role Description: ${description}
Capabilities & Skills: ${capabilities}
Identity Proofs: ${identity}
Trust Frameworks: ${trusts}
x402 Micropayments: ${file?.x402Support ? "Supported" : "Not Supported"}
  `.trim();
}
