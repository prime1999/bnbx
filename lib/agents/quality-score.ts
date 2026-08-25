// Calculates marketplace quality ranking score combining trust, confidence, and verification
export function calculateQualityScore(params: {
  trustScore: number;
  confidenceScore: number;
  verified: boolean;
}): number {
  const { trustScore, confidenceScore, verified } = params;

  // Weight component signals into composite score
  const trustComponent = trustScore * 0.5; // 50% weight on trust rating
  const confidenceComponent = confidenceScore * 100 * 0.3; // 30% weight on semantic confidence
  const verificationBonus = verified ? 20 : 0; // 20 points flat bonus for verified agents

  // Round final calculated marketplace quality score
  return Math.min(
    100,
    Math.round(trustComponent + confidenceComponent + verificationBonus),
  );
}
