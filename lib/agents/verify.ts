import type { RawAgent } from "./types";

export function verifyAgent(agent: RawAgent): boolean {
  const registration = agent.registrationFile;

  if (!registration) {
    return false;
  }

  // Must have a valid owner address.
  const validOwner = /^0x[a-fA-F0-9]{40}$/.test(agent.owner);

  if (!validOwner) {
    return false;
  }

  // At least one recognized trust mechanism.
  const hasTrustSignal = registration.supportedTrusts?.length > 0;

  // x402 is another useful trust/payment capability.
  const hasX402 = registration.x402Support === true;

  // Staking can provide an economic commitment.
  const hasStake =
    !!agent.stakingPool &&
    !agent.stakingPool.isSlashed &&
    BigInt(agent.stakingPool.stakedBalanceRaw || "0") > BigInt(0);

  // Reputation from actual feedback.
  const feedbackCount = Number(agent.totalFeedback || 0);

  const hasReputation = feedbackCount > 0;

  /*
   * We don't require every signal.
   *
   * An agent can still be legitimate without
   * having x402 or staking.
   */
  const trustSignals = [
    hasTrustSignal,
    hasX402,
    hasStake,
    hasReputation,
  ].filter(Boolean).length;

  return trustSignals >= 2;
}
