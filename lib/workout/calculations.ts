/**
 * Workout calculation utilities
 *
 * Core formulas for one-rep max estimation, training volume, and
 * progressive overload weight suggestions.
 *
 * Requirements: 5.3, 5.4, 6.6, 6.7, 7.5
 */

/**
 * Computes estimated one-rep max using the Epley formula.
 *
 * Epley formula: 1RM = weight × (1 + reps / 30)
 *
 * Only meaningful for reps between 1 and 10 per requirement 5.4.
 * Returns 0 for non-positive weight or rep count below 1 to guard
 * against nonsensical inputs.
 *
 * Requirement 5.4: estimate One_Rep_Max using the Epley_Formula
 */
export function computeOneRepMax(weight: number, reps: number): number {
  // Guard: weight must be positive and reps must be at least 1
  if (weight <= 0 || reps < 1) return 0;

  // Epley formula: multiply weight by (1 + reps/30)
  // Higher weight or more reps both increase the estimated 1RM monotonically
  return weight * (1 + reps / 30);
}

/**
 * Calculates total training volume across a collection of sets.
 *
 * Volume = Σ (weight × reps) for each set
 *
 * Requirement 5.3: compute total training volume as the sum of (weight × reps)
 */
export function calculateVolume(
  sets: Array<{ weight: number; reps: number }>
): number {
  // Summation is commutative — order of sets does not affect the result
  return sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

/**
 * Calculates suggested weight for the next session based on the
 * heuristic progressive overload algorithm.
 *
 * RPE-based rules (Requirement 6.6, 6.7, 7.5):
 *   RPE ≤ 6        → increase weight by 5%   (session felt easy)
 *   RPE 6–8        → increase weight by 2.5% (session felt moderate)
 *   RPE 8–9        → maintain weight         (session was at target effort)
 *   RPE > 9        → decrease weight by 2.5% (session was too hard)
 *
 * Hard cap: suggested weight must never exceed 110% of prevWeight,
 * regardless of RPE, to prevent injury from excessive load jumps.
 * (Requirement 7.5)
 *
 * The result is rounded to the nearest 0.5 kg to match standard
 * plate/dumbbell increments.
 */
export function calculateProgressiveOverload(
  prevWeight: number,
  rpe: number
): number {
  // Guard: non-positive previous weight is a no-op
  if (prevWeight <= 0) return prevWeight;

  let suggested: number;

  if (rpe <= 6) {
    // Session felt easy — apply the larger 5% increase to drive adaptation
    suggested = prevWeight * 1.05;
  } else if (rpe < 8) {
    // Session felt moderate (RPE 6–8) — apply the smaller 2.5% increase
    suggested = prevWeight * 1.025;
  } else if (rpe <= 9) {
    // Session was at target effort (RPE 8–9) — maintain current weight
    suggested = prevWeight;
  } else {
    // Session was too hard (RPE > 9) — reduce load by 2.5% to allow recovery
    suggested = prevWeight * 0.975;
  }

  // Hard cap: never suggest more than 110% of the previous weight
  // This prevents dangerous load jumps even if the formula says otherwise
  const maxWeight = prevWeight * 1.1;
  if (suggested > maxWeight) {
    suggested = maxWeight;
  }

  // Round to nearest 0.5 kg to align with practical equipment increments
  return Math.round(suggested * 2) / 2;
}
