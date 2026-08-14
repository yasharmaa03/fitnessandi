// ============================================================================
// Workout History API Route
// ============================================================================
// GET /api/workout/history - Fetch workout history for a user
// Requirements: 9.1, 9.2, 9.11, 9.12, 5.1, 5.2, 5.3
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/workout/history
 * 
 * Fetch workout history for a user with optional date filtering
 * 
 * Query Parameters:
 * - userId: string (required) - User ID to fetch history for
 * - startDate: string (optional) - Start date filter (YYYY-MM-DD format)
 * - endDate: string (optional) - End date filter (YYYY-MM-DD format)
 * - limit: number (optional) - Number of records to return (default 50, max 200)
 * 
 * Response (200):
 * {
 *   workouts: Array<{
 *     id: string;
 *     date: string;
 *     plan_name: string;
 *     duration_seconds: number | null;
 *     total_volume: number;
 *     set_count: number;
 *     status: string;
 *   }>;
 * }
 * 
 * Error Responses:
 * - 400: Missing userId or invalid query parameters
 * - 401: Missing authentication
 * - 500: Database error
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  
  // Extract and validate query parameters
  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limitParam = searchParams.get('limit');

  // Validate required userId parameter
  if (!userId || userId.trim() === '') {
    return new Response(
      JSON.stringify({
        error: 'Query parameter "userId" is required',
        code: 'MISSING_USER_ID',
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate and parse limit parameter
  let limit = 50; // Default limit
  if (limitParam) {
    // Check if the parameter contains a decimal point (not an integer)
    if (limitParam.includes('.')) {
      return new Response(
        JSON.stringify({
          error: 'Query parameter "limit" must be a positive integer',
          code: 'INVALID_LIMIT',
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return new Response(
        JSON.stringify({
          error: 'Query parameter "limit" must be a positive integer',
          code: 'INVALID_LIMIT',
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    // Cap at maximum 200
    limit = Math.min(parsedLimit, 200);
  }

  // Validate date format if provided (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    return new Response(
      JSON.stringify({
        error: 'Query parameter "startDate" must be in YYYY-MM-DD format',
        code: 'INVALID_START_DATE',
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (endDate && !dateRegex.test(endDate)) {
    return new Response(
      JSON.stringify({
        error: 'Query parameter "endDate" must be in YYYY-MM-DD format',
        code: 'INVALID_END_DATE',
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // TODO: Add authentication check
  // For now, we assume the userId is valid and authenticated
  // In production, verify auth token and match userId to authenticated user
  if (!userId) {
    return new Response(
      JSON.stringify({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const supabase = createServerClient();

  try {
    // Build the query to fetch workout logs with plan names
    // We need to join with workout_plans to get plan names
    // Use left join to include manual workouts (plan_id = null)
    // and aggregate logged_sets data for volume and set count
    let query = supabase
      .from('workout_logs')
      .select(`
        id,
        date,
        status,
        started_at,
        completed_at,
        workout_plans(name)
      `)
      .eq('user_id', userId);

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Apply ordering and limit
    query = query.order('date', { ascending: false }).limit(limit);

    const { data: workoutLogs, error: logsError } = await query;

    if (logsError) {
      console.error('[Workout History] Error fetching workout logs:', logsError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch workout history',
          code: 'DATABASE_ERROR',
          details: logsError.message,
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!workoutLogs || workoutLogs.length === 0) {
      // Return empty array if no workouts found
      return new Response(
        JSON.stringify({ workouts: [] }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch logged sets for all workout logs to calculate volume and set count
    const workoutIds = workoutLogs.map((log) => log.id);
    const { data: loggedSets, error: setsError } = await supabase
      .from('logged_sets')
      .select('workout_log_id, weight_kg, reps')
      .in('workout_log_id', workoutIds);

    if (setsError) {
      console.error('[Workout History] Error fetching logged sets:', setsError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch workout set data',
          code: 'DATABASE_ERROR',
          details: setsError.message,
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Group sets by workout_log_id and calculate volume and count
    const setsByWorkout = new Map<string, { totalVolume: number; setCount: number }>();
    
    if (loggedSets) {
      for (const set of loggedSets) {
        const workoutId = set.workout_log_id;
        const volume = set.weight_kg * set.reps;
        
        if (!setsByWorkout.has(workoutId)) {
          setsByWorkout.set(workoutId, { totalVolume: 0, setCount: 0 });
        }
        
        const current = setsByWorkout.get(workoutId)!;
        current.totalVolume += volume;
        current.setCount += 1;
      }
    }

    // Build response with aggregated data
    const workouts = workoutLogs.map((log) => {
      const setData = setsByWorkout.get(log.id) || { totalVolume: 0, setCount: 0 };
      
      // Calculate duration in seconds if completed
      let durationSeconds: number | null = null;
      if (log.completed_at && log.started_at) {
        const startTime = new Date(log.started_at).getTime();
        const endTime = new Date(log.completed_at).getTime();
        durationSeconds = Math.floor((endTime - startTime) / 1000);
      }

      return {
        id: log.id,
        date: log.date,
        // Use plan name if available, otherwise "Manual Workout"
        plan_name: (log.workout_plans as unknown as { name: string } | null)?.name || 'Manual Workout',
        duration_seconds: durationSeconds,
        total_volume: setData.totalVolume,
        set_count: setData.setCount,
        status: log.status,
      };
    });

    return new Response(
      JSON.stringify({ workouts }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Workout History] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
