// ============================================================================
// Weekly Workout Plan - Regenerate Day API Route
// ============================================================================
// POST endpoint for regenerating a specific day in a weekly workout plan
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';
import { validateRegenerationInput } from '@/lib/weekly-planner/validation';
import { fetchRecommendation, MLEngineError, InvalidMLResponseError } from '@/lib/weekly-planner/ml-client';
import { regenerateDay, DatabaseError } from '@/lib/weekly-planner/db';
import type { RegenerateDayRequest } from '@/lib/types/weekly-planner';
import {
  handleInvalidJSON,
  handleValidationError,
  handleServiceUnavailable,
  handleMLEngineError,
  handleInvalidMLResponse,
  handleDatabaseError,
  handleInternalError,
  handleNotFound,
  isServiceUnavailableError,
  ErrorCodes,
} from '@/lib/weekly-planner/errors';

/**
 * POST /api/workout/weekly-plan/regenerate-day
 * 
 * Regenerate exercises for a specific day in a weekly workout plan
 * 
 * Request Body (RegenerateDayRequest):
 * - weekly_plan_id: string (required, non-empty)
 * - day_index: number (required, 0-6 for Monday-Sunday)
 * 
 * Response:
 * - 200: Updated plan day with new exercises
 * - 400: Validation error (INVALID_JSON, VALIDATION_ERROR, INVALID_DAY_INDEX)
 * - 404: Plan not found (PLAN_NOT_FOUND)
 * - 500: ML Engine error (ML_ENGINE_ERROR) or database error (DATABASE_ERROR)
 * - 502: Invalid ML response (INVALID_ML_RESPONSE)
 * - 503: ML Engine unavailable (SERVICE_UNAVAILABLE)
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**
 */
export async function POST(request: Request): Promise<Response> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return handleInvalidJSON();
  }

  // Validate input
  // **Validates: Requirements 3.7, 3.8**
  const validationResult = validateRegenerationInput(body);
  if (!validationResult.valid) {
    return handleValidationError(validationResult.errors ?? ['Invalid input']);
  }

  // Type assertion after validation
  const data = body as RegenerateDayRequest;

  const supabase = createServerClient();

  try {
    // Step 1: Verify weekly_plan_id exists and get week_start_date
    // **Validates: Requirement 3.7**
    const { data: planData, error: planError } = await supabase
      .from('weekly_workout_plans')
      .select('id, week_start_date, user_id')
      .eq('id', data.weekly_plan_id)
      .single();

    if (planError || !planData) {
      return handleNotFound(
        'Weekly plan not found',
        ErrorCodes.PLAN_NOT_FOUND,
        { weekly_plan_id: data.weekly_plan_id }
      );
    }

    // Step 2: Calculate target date from week_start_date + day_index
    // **Validates: Requirement 3.3**
    const weekStartDate = new Date(planData.week_start_date);
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() + data.day_index);
    const targetDate = weekStartDate.toISOString().split('T')[0];

    // Step 3: Call fetchRecommendation() for single day
    // **Validates: Requirement 3.3**
    let mlResponse;
    try {
      mlResponse = await fetchRecommendation(planData.user_id, targetDate);
    } catch (error) {
      // Handle ML Engine errors
      if (error instanceof MLEngineError) {
        // Check if it's a network/unavailability error
        if (!error.statusCode || isServiceUnavailableError(error.originalError as Error)) {
          return handleServiceUnavailable(error, {
            weekly_plan_id: data.weekly_plan_id,
            day_index: data.day_index,
          });
        }

        // ML Engine returned an error response
        return handleMLEngineError(error, error.statusCode, {
          weekly_plan_id: data.weekly_plan_id,
          day_index: data.day_index,
        });
      }

      // Handle invalid ML response errors
      if (error instanceof InvalidMLResponseError) {
        return handleInvalidMLResponse(error.message, error.missingFields);
      }

      // Unexpected error during ML fetch
      throw error;
    }

    // Step 4: Call regenerateDay() to delete old day and insert new one in transaction
    // **Validates: Requirements 3.1, 3.2, 3.4, 3.9**
    let updatedDay;
    try {
      updatedDay = await regenerateDay(
        supabase,
        data.weekly_plan_id,
        data.day_index,
        mlResponse
      );
    } catch (error) {
      // Handle database errors
      if (error instanceof DatabaseError) {
        return handleDatabaseError(error.operation, error.originalError, {
          weekly_plan_id: data.weekly_plan_id,
          day_index: data.day_index,
        });
      }

      // Unexpected error
      throw error;
    }

    // Step 5: Return 200 with updated Plan_Day
    // **Validates: Requirement 3.10**
    return new Response(
      JSON.stringify(updatedDay),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleInternalError(error, 'POST /api/workout/weekly-plan/regenerate-day', {
      weekly_plan_id: data.weekly_plan_id,
      day_index: data.day_index,
    });
  }
}
