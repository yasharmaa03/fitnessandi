// ============================================================================
// Workout Plan API Route
// ============================================================================
// POST endpoint for creating workout plans
// Requirements: 9.1, 9.2, 9.3, 9.4, 9.10, 9.11, 2.1, 2.2, 2.4, 2.5
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';
import { validateWorkoutPlanInput } from '@/lib/workout/validation';
import type { WorkoutPlanInsert, WorkoutPlanRow, PlanExerciseRow } from '@/lib/types/workout';

/**
 * POST /api/workout/plan
 * 
 * Create a new workout plan with exercises
 * 
 * Request Body (WorkoutPlanInsert):
 * - user_id: string (required, non-empty)
 * - name: string (required, 1-200 characters)
 * - description?: string (optional, 0-1000 characters)
 * - exercises: Array<{
 *     exercise_id: string,
 *     target_sets: number (1-10),
 *     target_reps: number (1-999),
 *     rest_seconds: number (0-600),
 *     order_index: number (>= 0)
 *   }> (required, at least one exercise)
 * 
 * Response:
 * - 200: Created plan with exercises
 * - 400: Validation error
 * - 401: Missing authentication
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
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate input
  const validationResult = validateWorkoutPlanInput(body);
  if (!validationResult.valid) {
    return new Response(
      JSON.stringify({
        error: validationResult.error,
        code: 'VALIDATION_ERROR',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Type assertion after validation
  const data = body as WorkoutPlanInsert;

  // Check authentication (in a real app, this would verify JWT token)
  // For now, we'll check if user_id is provided (already validated above)
  if (!data.user_id) {
    return new Response(
      JSON.stringify({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createServerClient();

    // Use Supabase RPC for transaction or manual transaction handling
    // Since Supabase doesn't expose direct transaction control in the client,
    // we'll insert the plan first, then insert exercises
    // If exercises fail, we rely on the database to handle cleanup or we manually delete

    // Step 1: Insert workout plan
    const { data: planData, error: planError } = await supabase
      .from('workout_plans')
      .insert({
        user_id: data.user_id,
        name: data.name,
        description: data.description || null,
        is_template: false,
      })
      .select()
      .single();

    if (planError) {
      console.error('[Workout Plan] Error inserting plan:', planError);
      return new Response(
        JSON.stringify({
          error: 'Failed to create workout plan',
          code: 'DATABASE_ERROR',
          details: { message: planError.message },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!planData) {
      return new Response(
        JSON.stringify({
          error: 'Failed to create workout plan',
          code: 'DATABASE_ERROR',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Insert plan exercises
    const exercisesToInsert = data.exercises.map((exercise) => ({
      plan_id: planData.id,
      exercise_id: exercise.exercise_id,
      target_sets: exercise.target_sets,
      target_reps: exercise.target_reps,
      rest_seconds: exercise.rest_seconds,
      order_index: exercise.order_index,
    }));

    const { data: exercisesData, error: exercisesError } = await supabase
      .from('plan_exercises')
      .insert(exercisesToInsert)
      .select();

    if (exercisesError) {
      console.error('[Workout Plan] Error inserting exercises:', exercisesError);
      
      // Attempt to clean up the plan we just created
      await supabase
        .from('workout_plans')
        .delete()
        .eq('id', planData.id);

      return new Response(
        JSON.stringify({
          error: 'Failed to add exercises to workout plan',
          code: 'DATABASE_ERROR',
          details: { message: exercisesError.message },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Return created plan with exercises
    const response: WorkoutPlanRow & { exercises: PlanExerciseRow[] } = {
      ...planData,
      exercises: exercisesData || [],
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Workout Plan] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
