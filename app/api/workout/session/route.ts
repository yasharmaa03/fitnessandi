// ============================================================================
// Workout Session API Route
// ============================================================================
// POST /api/workout/session - Start a new workout session
// Requirements: 9.5, 9.6, 9.7, 9.11, 3.1, 3.2
// ============================================================================

import { validateSessionInput } from '@/lib/workout/validation';
import { createServerClient } from '@/lib/supabase/server';
import type { WorkoutSessionInsert, WorkoutLogRow } from '@/lib/types/workout';

/**
 * POST /api/workout/session
 * 
 * Start a new workout session by creating a workout_logs record.
 * 
 * Request Body:
 * - user_id: string (non-empty, required)
 * - plan_id: string (non-empty, required)
 * - date: string (YYYY-MM-DD format, required)
 * - notes: string (optional)
 * 
 * Response:
 * - 200: Session created successfully, returns WorkoutLogRow
 * - 400: Invalid request body or validation failure
 * - 401: Missing authentication
 * - 404: Plan not found
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

  // Validate input using validation utility
  const validation = validateSessionInput(body);
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

  // Type-safe access after validation
  const data = body as WorkoutSessionInsert;
  const { user_id, plan_id, date, notes } = data;

  // TODO: Add authentication check
  // For now, we assume the user_id is valid
  // In production, verify auth token and match user_id to authenticated user
  if (!user_id) {
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
    // Verify that the plan exists and belongs to the user (only if plan_id is provided)
    if (plan_id && plan_id !== 'default') {
      const { data: planData, error: planError } = await supabase
        .from('workout_plans')
        .select('id')
        .eq('id', plan_id)
        .eq('user_id', user_id)
        .single();

      if (planError || !planData) {
        return new Response(
          JSON.stringify({
            error: 'Plan not found',
            code: 'PLAN_NOT_FOUND',
          }),
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Create workout_logs record with status='in_progress'
    // Allow null plan_id for quick/ad-hoc workouts
    const { data: sessionData, error: sessionError } = await supabase
      .from('workout_logs')
      .insert({
        user_id,
        plan_id: (plan_id && plan_id !== 'default') ? plan_id : null,
        date,
        status: 'in_progress',
        notes: notes || null,
        started_at: new Date().toISOString(),
        completed_at: null,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[Workout Session] Database insert error:', sessionError);
      return new Response(
        JSON.stringify({
          error: 'Failed to create workout session',
          code: 'DATABASE_ERROR',
          details: sessionError.message,
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Return the created session data
    return new Response(
      JSON.stringify(sessionData),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Workout Session] Unexpected error:', error);
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
