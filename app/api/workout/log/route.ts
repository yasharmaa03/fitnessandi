import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/workout/log
 * Logs a workout entry: creates a workout_log row (if none exists for today)
 * then inserts all sets for the given exercise in one shot.
 *
 * Body: {
 *   user_id: string,
 *   date: string,            // YYYY-MM-DD
 *   exercise_id: string,
 *   exercise_name: string,
 *   sets: Array<{ set_number: number, weight_kg: number, reps: number, rpe?: number }>
 *   notes?: string
 * }
 *
 * Returns: { workout_log_id, sets: LoggedSetRow[] }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const { user_id, date, exercise_id, sets, notes } = data;

  if (!user_id || typeof user_id !== 'string' || !user_id.trim()) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  if (!exercise_id || typeof exercise_id !== 'string') {
    return NextResponse.json({ error: 'exercise_id is required' }, { status: 400 });
  }
  if (!Array.isArray(sets) || sets.length === 0) {
    return NextResponse.json({ error: 'sets must be a non-empty array' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Find or create a workout_log for this user+date
  let workoutLogId: string;

  const { data: existing } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', user_id)
    .eq('date', date)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    workoutLogId = existing.id as string;
  } else {
    const { data: newLog, error: logError } = await supabase
      .from('workout_logs')
      .insert({
        user_id,
        date,
        status: 'in_progress',
        notes: notes ?? null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (logError || !newLog) {
      console.error('Error creating workout log:', logError);
      return NextResponse.json({ error: 'Failed to create workout log' }, { status: 500 });
    }
    workoutLogId = newLog.id as string;
  }

  // Insert all sets
  const setRows = (sets as Array<Record<string, unknown>>).map((s, i) => ({
    workout_log_id: workoutLogId,
    exercise_id,
    set_number: (s.set_number as number) ?? i + 1,
    weight_kg: s.weight_kg as number,
    reps: s.reps as number,
    rpe: (s.rpe as number | undefined) ?? null,
    logged_at: new Date().toISOString(),
  }));

  const { data: insertedSets, error: setsError } = await supabase
    .from('logged_sets')
    .insert(setRows)
    .select();

  if (setsError) {
    console.error('Error inserting sets:', setsError);
    return NextResponse.json({ error: 'Failed to log sets' }, { status: 500 });
  }

  return NextResponse.json({ workout_log_id: workoutLogId, sets: insertedSets ?? [] }, { status: 201 });
}

/**
 * DELETE /api/workout/log
 * Deletes all logged_sets for a given exercise within a workout_log.
 * Body: { workout_log_id: string, exercise_id: string, user_id: string }
 */
export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const { workout_log_id, exercise_id, user_id } = data;

  if (!workout_log_id || !exercise_id || !user_id) {
    return NextResponse.json({ error: 'workout_log_id, exercise_id and user_id are required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Verify ownership via workout_logs
  const { data: log } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('id', workout_log_id)
    .eq('user_id', user_id)
    .maybeSingle();

  if (!log) {
    return NextResponse.json({ error: 'Workout log not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('logged_sets')
    .delete()
    .eq('workout_log_id', workout_log_id)
    .eq('exercise_id', exercise_id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete sets' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
