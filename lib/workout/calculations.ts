// Workout calculation utilities

/**
 * Computes one-rep max using the Epley formula
 * Formula: 1RM = weight × (1 + reps/30)
 * 
 * @param weight - Weight lifted in kg
 * @param reps - Number of repetitions performed (typically 1-10)
 * @returns Estimated one-rep max in kg
 */
export function computeOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps < 1) {
    return 0;
  }
  
  // Epley formula: 1RM = weight × (1 + reps/30)
  return weight * (1 + reps / 30);
}

/**
 * Calculates total training volume from a set of logged sets
 * Volume = sum of (weight × reps) for all sets
 * 
 * @param sets - Array of sets with weight and reps
 * @returns Total volume in kg
 */
export function calculateVolume(
  sets: Array<{ weight: number; reps: number }>
): number {
  return sets.reduce((total, set) => {
    return total + set.weight * set.reps;
  }, 0);
}

/**
 * Calculates progressive overload weight suggestion based on previous performance
 * Uses RPE (Rate of Perceived Exertion) to determine appropriate progression
 * 
 * Rules:
 * - RPE < 8: Increase weight by 2.5-5%
 * - RPE 8-9: Maintain weight
 * - RPE > 9: Decrease weight by 2.5%
 * - Never increase more than 10% from previous session
 * 
 * @param prevWeight - Previous session weight in kg
 * @param rpe - Rate of Perceived Exertion (1-10 scale)
 * @returns Suggested weight for next session in kg
 */
export function calculateProgressiveOverload(
  prevWeight: number,
  rpe: number
): number {
  if (prevWeight <= 0) {
    return prevWeight;
  }

  let suggestedWeight = prevWeight;

  // RPE-based adjustment
  if (rpe < 8) {
    // Low RPE: increase by 2.5-5%
    const increase = prevWeight * 0.025; // 2.5% increase
    suggestedWeight = prevWeight + increase;
  } else if (rpe > 9) {
    // High RPE: maintain or decrease by 2.5%
    const decrease = prevWeight * 0.025; // 2.5% decrease
    suggestedWeight = prevWeight - decrease;
  } else {
    // RPE 8-9: maintain weight
    suggestedWeight = prevWeight;
  }

  // Cap at 110% of previous weight (safety limit)
  const maxWeight = prevWeight * 1.1;
  if (suggestedWeight > maxWeight) {
    suggestedWeight = maxWeight;
  }

  // Round to nearest 0.5 kg for practical loading
  return Math.round(suggestedWeight * 2) / 2;
}

/**
 * Formats weight for display with appropriate precision
 * 
 * @param weight - Weight in kg
 * @returns Formatted weight string (e.g., "50", "22.5")
 */
export function formatWeight(weight: number): string {
  // Remove unnecessary decimal places
  return weight % 1 === 0 ? weight.toString() : weight.toFixed(1);
}

/**
 * Calculates workout duration in minutes
 * 
 * @param startTime - ISO-8601 timestamp
 * @param endTime - ISO-8601 timestamp
 * @returns Duration in minutes
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMs = end - start;
  return Math.round(durationMs / 1000 / 60); // Convert to minutes
}

/**
 * Formats duration for display
 * 
 * @param minutes - Duration in minutes
 * @returns Formatted duration string (e.g., "47:23", "1:05:30")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.round((minutes % 1) * 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
