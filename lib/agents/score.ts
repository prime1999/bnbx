import type { RawAgent } from "./types";

interface ScoreInput {
  agent: RawAgent;
  verified: boolean;
}

export function scoreAgent({ agent, verified }: ScoreInput): number {
  const registration = agent.registrationFile;

  let score = 0;

  /*
   * Verification
   *
   * Maximum: 30
   */
  if (verified) {
    score += 30;
  }

  /*
   * Reputation
   *
   * Maximum: 25
   */
  const feedback = Number(agent.totalFeedback || 0);

  const reputationScore = Math.min(feedback / 20, 25);

  score += reputationScore;

  /*
   * Trust mechanisms
   *
   * Maximum: 20
   */
  const trustCount = registration?.supportedTrusts?.length ?? 0;

  score += Math.min(trustCount * 6.67, 20);

  /*
   * x402 support
   *
   * Maximum: 10
   */
  if (registration?.x402Support === true) {
    score += 10;
  }

  /*
   * Staking
   *
   * Maximum: 15
   */
  if (
    agent.stakingPool &&
    !agent.stakingPool.isSlashed &&
    BigInt(agent.stakingPool.stakedBalanceRaw || "0") > BigInt(0)
  ) {
    score += 15;
  }

  return Math.min(Math.round(score), 100);
}
