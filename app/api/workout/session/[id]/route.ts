// ============================================================================
// Workout Session Update API Route
// ============================================================================
// PATCH /api/workout/session/:id - Update workout session status
// Requirements: 3.9, 3.10, 3.11
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';
import type { WorkoutLogRow, WorkoutStatus } from '@/lib/types/workout';

/**
 * Validate session status update input
 * 
 * Checks:
 * - status is one of 'completed' or 'abandoned'
 * - notes is a string (optional)
 */
function validateSessionUpdateInput(input: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof input !== 'object' || input === null) {
    return {
      valid: false,
      error: 'Input must be a non-null object',
    };
  }

  const data = input as Record<string, unknown>;

  // Validate status (required, must be 'completed' or 'abandoned')
  if (typeof data.status !== 'string') {
    return {
      valid: false,
      error: 'Field "status" is required and must be a string',
    };
  }

  if (data.status !== 'completed' && data.status !== 'abandoned') {
    return {
      valid: false,
      error: 'Field "status" must be either "completed" or "abandoned"',
    };
  }

  // Validate notes (optional, must be string if provided)
  if (data.notes !== undefined && data.notes !== null) {
    if (typeof data.notes !== 'string') {
      return {
        valid: false,
        error: 'Field "notes" must be a string if provided',
      };
    }
  }

  return { valid: true };
}

/**
 * PATCH /api/workout/session/:id
 * 
 * Update session status (mark as completed or abandoned).
 * Sets completed_at timestamp when status changes from 'in_progress'.
 * Validates status transition (only allow in_progress → completed or abandoned).
 * 
 * Request Body:
 * - status: 'completed' | 'abandoned' (required)
 * - notes: string (optional)
 * 
 * Response:
 * - 200: Session updated successfully, returns WorkoutLogRow
 * - 400: Invalid request body, validation failure, or invalid status transition
 * - 401: Missing authentication
 * - 404: Session not found
 * - 500: Database error
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: sessionId } = await params;

  // Validate session ID
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return new Response(
      JSON.stringify({
        error: 'Session ID is required',
        code: 'INVALID_SESSION_ID',
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

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

  // Validate input
  const validation = validateSessionUpdateInput(body);
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
  const data = body as { status: WorkoutStatus; notes?: string };
  const { status, notes } = data;

  const supabase = createServerClient();

  try {
    // Fetch the existing session to validate status transition
    const { data: existingSession, error: fetchError } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !existingSession) {
      return new Response(
        JSON.stringify({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate status transition: only allow in_progress → completed or abandoned
    if (existingSession.status !== 'in_progress') {
      return new Response(
        JSON.stringify({
          error: `Invalid status transition: cannot change from "${existingSession.status}" to "${status}". Only transitions from "in_progress" are allowed.`,
          code: 'INVALID_STATUS_TRANSITION',
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Prepare update data
    const updateData: Partial<WorkoutLogRow> = {
      status,
      completed_at: new Date().toISOString(),
    };

    // Add notes if provided
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Update the session
    const { data: updatedSession, error: updateError } = await supabase
      .from('workout_logs')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('[Workout Session Update] Database update error:', updateError);
      return new Response(
        JSON.stringify({
          error: 'Failed to update workout session',
          code: 'DATABASE_ERROR',
          details: updateError.message,
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Return the updated session data
    return new Response(
      JSON.stringify(updatedSession),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Workout Session Update] Unexpected error:', error);
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
