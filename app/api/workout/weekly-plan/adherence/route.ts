// ============================================================================
// Weekly Plan Adherence API Route
// ============================================================================
// PATCH endpoint for updating adherence status of plan days
// Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';
import { validateAdherenceInput } from '@/lib/weekly-planner/validation';
import { updateAdherence, DatabaseError } from '@/lib/weekly-planner/db';
import type { UpdateAdherenceRequest } from '@/lib/types/weekly-planner';

/**
 * PATCH /api/workout/weekly-plan/adherence
 * 
 * Update adherence status for a specific plan day
 * 
 * Request Body (UpdateAdherenceRequest):
 * - plan_day_id: string (required, non-empty)
 * - adherence_status: AdherenceStatus (required, one of: 'not_started', 'in_progress', 'completed', 'skipped')
 * 
 * Behavior:
 * - Updates adherence_status field for the specified plan day
 * - If status is 'completed', sets completed_at to current timestamp
 * - For other statuses, completed_at remains unchanged
 * 
 * Response:
 * - 200: Updated plan day with new adherence_status and completed_at
 * - 400: Validation error (INVALID_JSON, VALIDATION_ERROR)
 * - 404: Plan day not found (PLAN_DAY_NOT_FOUND)
 * - 500: Database error (DATABASE_ERROR)
 * 
 * **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**
 */
export async function PATCH(request: Request): Promise<Response> {
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
  // **Validates: Requirements 4.4, 4.5**
  const validationResult = validateAdherenceInput(body);
  if (!validationResult.valid) {
    return new Response(
      JSON.stringify({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: { errors: validationResult.errors },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Type assertion after validation
  const data = body as UpdateAdherenceRequest;

  try {
    // Update adherence status in database
    // This function handles:
    // - Setting adherence_status to the new value (Requirement 4.5)
    // - Setting completed_at to NOW() if status is 'completed' (Requirement 4.6)
    // - Leaving completed_at unchanged for other statuses
    const supabase = createServerClient();
    const updatedDay = await updateAdherence(
      supabase,
      data.plan_day_id,
      data.adherence_status
    );

    // Return 200 with updated plan day
    // **Validates: Requirements 4.7**
    return new Response(
      JSON.stringify(updatedDay),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Handle database errors
    if (error instanceof DatabaseError) {
      console.error('[Adherence Update] Database error:', error.message);

      // Check if it's a "not found" error
      // This happens when plan_day_id doesn't exist
      const pgError = error.originalError as any;
      
      // If no rows were updated, the plan_day_id doesn't exist
      // Check for PGRST116 (PostgREST not found) or "no data" or "succeeded but no data" in message
      if (
        pgError?.code === 'PGRST116' || 
        error.message.includes('no data') ||
        error.message.includes('succeeded but no data') ||
        error.message.includes('not found')
      ) {
        return new Response(
          JSON.stringify({
            error: 'Plan day not found',
            code: 'PLAN_DAY_NOT_FOUND',
            details: { plan_day_id: data.plan_day_id },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // General database error
      return new Response(
        JSON.stringify({
          error: 'Failed to update adherence status',
          code: 'DATABASE_ERROR',
          details: { message: error.message },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle unexpected errors
    console.error('[Adherence Update] Unexpected error:', error);
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
