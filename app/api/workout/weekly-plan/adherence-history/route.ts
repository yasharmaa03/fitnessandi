// ============================================================================
// Weekly Workout Plan Adherence History API Route
// ============================================================================
// GET endpoint for retrieving adherence history and statistics
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 6.10
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';
import { getAdherenceHistory, DatabaseError } from '@/lib/weekly-planner/db';

/**
 * GET /api/workout/weekly-plan/adherence-history
 * 
 * Retrieve adherence history and statistics for a user
 * 
 * Query Parameters:
 * - user_id: string (required, non-empty)
 * - weeks_back: number (optional, default 4, max 12)
 * 
 * Returns adherence statistics including:
 * - Overall completion rate percentage
 * - Weekly breakdown with per-week completion rates (newest first)
 * - Day-of-week breakdown showing Monday-Sunday completion patterns
 * - Average workout duration (completed days only)
 * - Top 3 most completed muscle groups
 * 
 * Returns 200 with zero values if no plans exist.
 * 
 * Response:
 * - 200: Adherence statistics (even if no plans exist)
 * - 400: Validation error (missing user_id, invalid weeks_back)
 * - 500: Database error (DATABASE_ERROR)
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 6.10**
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const weeksBackParam = searchParams.get('weeks_back');

    // Validate required user_id parameter
    // **Validates: Requirement 6.1**
    if (!userId || userId.trim() === '') {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameter: user_id',
          code: 'VALIDATION_ERROR',
          details: { errors: ['user_id is required'] },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate weeks_back parameter
    // Default to 4 if not provided, cap at 12 max
    // **Validates: Requirement 6.1**
    let weeksBack = 4;
    if (weeksBackParam) {
      const parsed = parseInt(weeksBackParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return new Response(
          JSON.stringify({
            error: 'Invalid weeks_back parameter',
            code: 'VALIDATION_ERROR',
            details: { errors: ['weeks_back must be a positive integer'] },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // The db function caps at 12, but we validate here too for clarity
      weeksBack = Math.min(parsed, 12);
    }

    // Fetch adherence history from database
    // This function:
    // - Queries all Weekly_Plans for user within weeks_back range
    // - Calculates total_planned_days (excluding 'not_started')
    // - Calculates completed_days, skipped_days, in_progress_days
    // - Calls calculateCompletionRate() for overall completion_rate_percentage
    // - Groups by week_start_date with per-week completion rates
    // - Calls aggregateByDayOfWeek() for day_of_week_breakdown
    // - Calls calculateAverageDuration() for completed days only
    // - Calls getTopMuscleGroups() for most_completed_muscle_groups (top 3)
    // - Returns 200 with zero values if no plans exist
    // **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 6.10**
    const supabase = createServerClient();
    const adherenceStats = await getAdherenceHistory(
      supabase,
      userId,
      weeksBack
    );

    // Return 200 with adherence statistics
    // Even if no plans exist, returns zero values
    // **Validates: Requirement 6.6**
    return new Response(
      JSON.stringify(adherenceStats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Handle database errors
    if (error instanceof DatabaseError) {
      console.error('[Adherence History] Database error:', error.message);
      return new Response(
        JSON.stringify({
          error: 'Failed to retrieve adherence history',
          code: 'DATABASE_ERROR',
          details: { message: error.message },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle unexpected errors
    console.error('[Adherence History] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
