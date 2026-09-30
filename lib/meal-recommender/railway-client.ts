/**
 * railway-client.ts - Client for Railway ML service meal ranking endpoint
 * 
 * Calls the /rank-meals endpoint on Railway to get ML-based meal rankings
 */

const ML_SERVICE_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000';

export interface MealCandidate {
  meal_id: string;
  meal_name: string;
  features: number[];
  [key: string]: any; // Allow additional meal properties
}

export interface RankedMeal extends MealCandidate {
  score: number;
}

export interface RankMealsRequest {
  candidates: MealCandidate[];
}

export interface RankMealsResponse {
  ranked: RankedMeal[];
}

/**
 * Call Railway ML service to rank meals using LightGBM model
 * 
 * @param candidates - Array of meal candidates with 7-element feature vectors
 * @returns Array of candidates with scores, sorted by score (descending)
 */
export async function rankMealsWithML(
  candidates: MealCandidate[]
): Promise<RankedMeal[]> {
  try {
    console.log(`[Railway Client] Ranking ${candidates.length} meals via ML service`);
    
    const response = await fetch(`${ML_SERVICE_URL}/rank-meals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ candidates }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Railway ML service error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data: RankMealsResponse = await response.json();
    
    console.log(`[Railway Client] Successfully ranked ${data.ranked.length} meals`);
    return data.ranked;

  } catch (error) {
    console.error('[Railway Client] Failed to rank meals:', error);
    throw error;
  }
}

/**
 * Extract scores from ranked meals for compatibility with existing code
 * 
 * @param rankedMeals - Meals with scores from Railway
 * @returns Array of scores in same order as input
 */
export function extractScores(rankedMeals: RankedMeal[]): number[] {
  return rankedMeals.map(meal => meal.score);
}
