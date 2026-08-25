import { RawAgent, VerificationEvidence } from "./types";

// Verifies identity and proof mechanisms based on actual Subgraph schema
export function verifyAgent(agent: RawAgent): {
  verified: boolean;
  evidence: VerificationEvidence;
} {
  const file = agent.registrationFile;

  // Check valid registration ID
  const erc8004Verified = Boolean(agent.agentId && agent.agentId !== "0");

  // Check validator attestations on-chain
  const hasValidations = Boolean(
    agent.validations &&
    agent.validations.length > 0 &&
    agent.validations.some((v) => v.status === "passed" || v.status === "1"),
  );

  // Check if agent configured supported trust mechanisms
  const hasTrustMechanisms = Boolean(
    file?.supportedTrusts && file.supportedTrusts.length > 0,
  );

  // Check x402 payment support flag
  const x402Enabled = Boolean(file?.x402Support);

  // Check ENS or DID identity
  const hasENSorDID = Boolean(file?.ens || file?.did);

  // Overall verified status
  const verified =
    erc8004Verified &&
    (hasValidations || hasTrustMechanisms || hasENSorDID || x402Enabled);

  return {
    verified,
    evidence: {
      erc8004Verified,
      hasValidations,
      hasTrustMechanisms,
      x402Enabled,
      hasENSorDID,
    },
  };
}
