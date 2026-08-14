// ============================================================================
// Weekly Workout Plan API Route
// ============================================================================
// POST endpoint for creating 7-day weekly workout plans
// GET endpoint for retrieving weekly workout plans
// Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 9.4, 9.9, 5.1-5.10
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';
import { validateWeeklyPlanInput, normalizeToMonday } from '@/lib/weekly-planner/validation';
import { fetchWeeklyRecommendations, MLEngineError, InvalidMLResponseError } from '@/lib/weekly-planner/ml-client';
import { createWeeklyPlan, DatabaseError, getWeeklyPlan } from '@/lib/weekly-planner/db';
import type { CreateWeeklyPlanRequest } from '@/lib/types/weekly-planner';
import {
  handleInvalidJSON,
  handleValidationError,
  handleServiceUnavailable,
  handleMLEngineError,
  handleInvalidMLResponse,
  handleDatabaseError,
  handleConflict,
  handleInternalError,
  handleNotFound,
  isUniqueConstraintViolation,
  isServiceUnavailableError,
  ErrorCodes,
} from '@/lib/weekly-planner/errors';
import { logAPIRequest, logError, createTimer } from '@/lib/weekly-planner/logger';

/**
 * POST /api/workout/weekly-plan
 * 
 * Create a new 7-day weekly workout plan with ML-generated recommendations
 * 
 * Request Body (CreateWeeklyPlanRequest):
 * - user_id: string (required, non-empty)
 * - week_start_date: string (required, YYYY-MM-DD format, will be normalized to Monday)
 * 
 * Response:
 * - 201: Created weekly plan with all 7 days and exercises
 * - 400: Validation error (INVALID_JSON, VALIDATION_ERROR)
 * - 409: Plan already exists for this user and week (PLAN_ALREADY_EXISTS)
 * - 500: ML Engine error (ML_ENGINE_ERROR) or database error (DATABASE_ERROR)
 * - 502: Invalid ML response (INVALID_ML_RESPONSE)
 * - 503: ML Engine unavailable (SERVICE_UNAVAILABLE)
 * 
 * **Validates: Requirements 2.1, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 9.4, 9.9**
 */
export async function POST(request: Request): Promise<Response> {
  const timer = createTimer();
  let userId: string | undefined;

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logAPIRequest({
      endpoint: '/api/workout/weekly-plan',
      method: 'POST',
      duration_ms: timer.elapsed(),
      status_code: 400,
      message: 'Invalid JSON in request body',
    });
    return handleInvalidJSON();
  }

  // Validate input
  const validationResult = validateWeeklyPlanInput(body);
  if (!validationResult.valid) {
    logAPIRequest({
      endpoint: '/api/workout/weekly-plan',
      method: 'POST',
      duration_ms: timer.elapsed(),
      status_code: 400,
      message: 'Validation failed',
      context: { errors: validationResult.errors },
    });
    return handleValidationError(validationResult.errors ?? ['Invalid input']);
  }

  // Type assertion after validation
  const data = body as CreateWeeklyPlanRequest;
  userId = data.user_id;

  try {
    // Normalize week_start_date to Monday
    // **Validates: Requirement 2.7**
    const normalizedDate = normalizeToMonday(data.week_start_date);

    // Fetch 7 days of ML recommendations
    // **Validates: Requirements 2.1, 2.8**
    let mlResponses;
    try {
      mlResponses = await fetchWeeklyRecommendations(data.user_id, normalizedDate);
    } catch (error) {
      // Handle ML Engine errors
      if (error instanceof MLEngineError) {
        // Check if it's a network/unavailability error
        if (!error.statusCode || isServiceUnavailableError(error.originalError as Error)) {
          const response = handleServiceUnavailable(error, { user_id: data.user_id });
          logAPIRequest({
            endpoint: '/api/workout/weekly-plan',
            method: 'POST',
            user_id: data.user_id,
            duration_ms: timer.elapsed(),
            status_code: 503,
            message: 'ML Engine unavailable',
          });
          return response;
        }

        // ML Engine returned an error response
        const response = handleMLEngineError(error, error.statusCode, { user_id: data.user_id });
        logAPIRequest({
          endpoint: '/api/workout/weekly-plan',
          method: 'POST',
          user_id: data.user_id,
          duration_ms: timer.elapsed(),
          status_code: 500,
          message: 'ML Engine error',
          context: { error: error.message },
        });
        return response;
      }

      // Handle invalid ML response errors
      if (error instanceof InvalidMLResponseError) {
        const response = handleInvalidMLResponse(error.message, error.missingFields);
        logAPIRequest({
          endpoint: '/api/workout/weekly-plan',
          method: 'POST',
          user_id: data.user_id,
          duration_ms: timer.elapsed(),
          status_code: 502,
          message: 'Invalid ML Engine response',
          context: { missing_fields: error.missingFields },
        });
        return response;
      }

      // Unexpected error during ML fetch
      throw error;
    }

    // Create weekly plan in database with transaction
    // **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.9**
    const supabase = createServerClient();
    let createdPlan;
    
    try {
      createdPlan = await createWeeklyPlan(
        supabase,
        data.user_id,
        normalizedDate,
        mlResponses
      );
    } catch (error) {
      // Handle duplicate plan error (unique constraint violation)
      if (error instanceof DatabaseError && isUniqueConstraintViolation(error.originalError)) {
        const response = handleConflict(
          'A workout plan already exists for this week',
          { 
            user_id: data.user_id,
            week_start_date: normalizedDate,
          }
        );
        logAPIRequest({
          endpoint: '/api/workout/weekly-plan',
          method: 'POST',
          user_id: data.user_id,
          duration_ms: timer.elapsed(),
          status_code: 409,
          message: 'Plan already exists for this week',
        });
        return response;
      }

      // Handle general database errors
      if (error instanceof DatabaseError) {
        const response = handleDatabaseError(error.operation, error.originalError, {
          user_id: data.user_id,
          week_start_date: normalizedDate,
        });
        logAPIRequest({
          endpoint: '/api/workout/weekly-plan',
          method: 'POST',
          user_id: data.user_id,
          duration_ms: timer.elapsed(),
          status_code: 500,
          message: 'Database error during plan creation',
          context: { error: error.message },
        });
        return response;
      }

      // Unexpected error
      throw error;
    }

    // Fetch the complete plan with all days and exercises for response
    const completePlan = await getWeeklyPlan(supabase, data.user_id, normalizedDate);

    if (!completePlan) {
      // This shouldn't happen, but handle it gracefully
      const response = handleDatabaseError(
        'retrieve created plan',
        'Plan created but failed to retrieve complete data',
        { plan_id: createdPlan.id }
      );
      logAPIRequest({
        endpoint: '/api/workout/weekly-plan',
        method: 'POST',
        user_id: data.user_id,
        duration_ms: timer.elapsed(),
        status_code: 500,
        message: 'Failed to retrieve created plan',
      });
      return response;
    }

    // Return 201 Created with complete nested structure
    // **Validates: Requirement 2.6**
    logAPIRequest({
      endpoint: '/api/workout/weekly-plan',
      method: 'POST',
      user_id: data.user_id,
      duration_ms: timer.elapsed(),
      status_code: 201,
      message: 'Successfully created weekly workout plan',
      context: {
        plan_id: createdPlan.id,
        week_start_date: normalizedDate,
        days: 7,
      },
    });

    return new Response(
      JSON.stringify(completePlan),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError({
      message: 'Unexpected error in POST /api/workout/weekly-plan',
      error_code: 'INTERNAL_ERROR',
      error_details: error,
      context: { user_id: userId },
    });
    return handleInternalError(error, 'POST /api/workout/weekly-plan', { user_id: data.user_id });
  }
}

/**
 * GET /api/workout/weekly-plan
 * 
 * Retrieve a weekly workout plan with all days and exercises
 * 
 * Query Parameters:
 * - user_id: string (required, non-empty)
 * - week_start_date: string (optional, YYYY-MM-DD format)
 * 
 * Behavior:
 * - If week_start_date provided: returns exact match for that week
 * - If week_start_date omitted: returns most recent plan (ORDER BY week_start_date DESC LIMIT 1)
 * 
 * Response:
 * - 200: Weekly plan with nested structure (plan → days → exercises)
 * - 400: Validation error (missing user_id)
 * - 404: No plan found (NO_PLAN_FOUND)
 * - 500: Database error (DATABASE_ERROR)
 * 
 * Response includes:
 * - All 7 Plan_Days ordered by day_index ascending
 * - All exercises for each day ordered by order_index ascending
 * - Exercise details (name, muscle_group, equipment) from exercises table
 * - adherence_status for each Plan_Day
 * - plan_metadata.total_weekly_duration_minutes (sum of all day durations)
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10**
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const weekStartDate = searchParams.get('week_start_date');

    // Validate required user_id parameter
    if (!userId || userId.trim() === '') {
      return handleValidationError(['user_id is required']);
    }

    // Validate week_start_date format if provided
    if (weekStartDate) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(weekStartDate)) {
        return handleValidationError(['week_start_date must be in YYYY-MM-DD format']);
      }
    }

    // Fetch the weekly plan
    // If weekStartDate is provided: exact match
    // If weekStartDate is omitted: most recent plan
    // **Validates: Requirements 5.2, 5.3**
    const supabase = createServerClient();
    const plan = await getWeeklyPlan(
      supabase,
      userId,
      weekStartDate || undefined
    );

    // Return 404 if no plan found
    // **Validates: Requirement 5.4**
    if (!plan) {
      return handleNotFound(
        weekStartDate 
          ? `No plan found for week starting ${weekStartDate}`
          : 'No plans found for this user',
        ErrorCodes.NO_PLAN_FOUND,
        { 
          user_id: userId,
          week_start_date: weekStartDate || null,
        }
      );
    }

    // Return 200 with complete nested structure
    // Plan includes:
    // - All 7 days ordered by day_index (Requirement 5.5)
    // - Exercises ordered by order_index (Requirement 5.6)
    // - Exercise details from exercises table (Requirement 5.7)
    // - adherence_status for each day (Requirement 5.10)
    // - total_weekly_duration_minutes (Requirement 5.9)
    // **Validates: Requirements 5.5, 5.6, 5.7, 5.8, 5.9, 5.10**
    return new Response(
      JSON.stringify(plan),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Handle database errors
    if (error instanceof DatabaseError) {
      return handleDatabaseError(error.operation, error.originalError);
    }

    // Handle unexpected errors
    return handleInternalError(error, 'GET /api/workout/weekly-plan');
  }
}

/**
 * DELETE /api/workout/weekly-plan?plan_id=xxx
 * 
 * Delete a weekly workout plan (for testing purposes)
 * 
 * Query Parameters:
 * - plan_id: string (required) - UUID of the plan to delete
 * 
 * Response:
 * - 200: Plan deleted successfully
 * - 400: Missing or invalid plan_id
 * - 404: Plan not found
 * - 500: Database error
 */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('plan_id');

    if (!planId || !planId.trim()) {
      return new Response(
        JSON.stringify({
          error: 'plan_id is required',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createServerClient();

    // Delete the plan (CASCADE will delete days and exercises)
    const { error } = await supabase
      .from('weekly_workout_plans')
      .delete()
      .eq('id', planId);

    if (error) {
      return new Response(
        JSON.stringify({
          error: 'Failed to delete plan',
          code: 'DATABASE_ERROR',
          details: { message: error.message },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Plan deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleInternalError(error, 'DELETE /api/workout/weekly-plan');
  }
}
