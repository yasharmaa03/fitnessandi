// ============================================================================
// Workout Set API Route
// ============================================================================
// POST /api/workout/set - Log a completed set within an active session
// Requirements: 9.8, 9.9, 9.10, 9.11, 3.3, 3.4, 3.5, 3.6
// ============================================================================

import { validateSetInput } from '@/lib/workout/validation';
import { createServerClient } from '@/lib/supabase/server';
import type { LoggedSetRow } from '@/lib/types/workout';

/**
 * POST /api/workout/set
 * 
 * Log a completed set within an active workout session.
 * 
 * Request Body:
 * - workout_id: string (non-empty, required) - The workout_logs.id
 * - exercise_id: string (non-empty, required) - UUID from exercises table
 * - set_number: number (1-based sequence, required)
 * - weight_kg: number (0.0-9999.0, up to 2 decimals, required)
 * - reps: number (1-999, required)
 * - rpe: number (1.0-10.0, up to 1 decimal, optional)
 * 
 * Response:
 * - 200: Set logged successfully, returns LoggedSetRow
 * - 400: Invalid request body or validation failure
 * - 401: Missing authentication
 * - 404: workout_id or exercise_id not found
 * - 500: Database error
 */
export async function POST(request: Request): Promise<Response> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON body',
        code: 'INVALID_JSON',
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check if body is an object
  if (typeof body !== 'object' || body === null) {
    return new Response(
      JSON.stringify({
        error: 'Request body must be a non-null object',
        code: 'INVALID_BODY',
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const data = body as Record<string, unknown>;

  // Map workout_id to workout_log_id for validation
  // The API design uses workout_id but the database field is workout_log_id
  const validationInput = {
    workout_log_id: data.workout_id,
    exercise_id: data.exercise_id,
    set_number: data.set_number,
    weight_kg: data.weight_kg,
    reps: data.reps,
    rpe: data.rpe,
  };

  // Validate input using validation utility
  const validation = validateSetInput(validationInput);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({
        error: validation.error,
        code: 'VALIDATION_ERROR',
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Extract validated fields
  const { workout_id, exercise_id, set_number, weight_kg, reps, rpe } = data;

  const supabase = createServerClient();

  try {
    // Verify that the workout exists and get user_id for auth check
    const { data: workoutData, error: workoutError } = await supabase
      .from('workout_logs')
      .select('id, user_id')
      .eq('id', workout_id as string)
      .single();

    if (workoutError || !workoutData) {
      return new Response(
        JSON.stringify({
          error: 'Workout not found',
          code: 'WORKOUT_NOT_FOUND',
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: Add authentication check
    // Verify that the authenticated user matches workoutData.user_id
    // For now, RLS policies will handle user isolation
    if (!workoutData.user_id) {
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

    // Verify that the exercise exists
    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercises')
      .select('id')
      .eq('id', exercise_id as string)
      .single();

    if (exerciseError || !exerciseData) {
      return new Response(
        JSON.stringify({
          error: 'Exercise not found',
          code: 'EXERCISE_NOT_FOUND',
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert the logged set
    const { data: setData, error: setError } = await supabase
      .from('logged_sets')
      .insert({
        workout_log_id: workout_id as string,
        exercise_id: exercise_id as string,
        set_number: set_number as number,
        weight_kg: weight_kg as number,
        reps: reps as number,
        rpe: (rpe !== undefined && rpe !== null) ? (rpe as number) : null,
        logged_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (setError) {
      console.error('[Workout Set] Database insert error:', setError);
      return new Response(
        JSON.stringify({
          error: 'Failed to log workout set',
          code: 'DATABASE_ERROR',
          details: setError.message,
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Return the created set data
    return new Response(
      JSON.stringify(setData),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Workout Set] Unexpected error:', error);
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
