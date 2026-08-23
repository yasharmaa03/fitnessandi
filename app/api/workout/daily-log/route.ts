import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/workout/daily-log?userId=...&date=YYYY-MM-DD
 * Returns all logged exercises (with sets) for a given user+date.
 *
 * Response:
 * {
 *   workout_log_id: string | null,
 *   exercises: Array<{
 *     exercise_id: string,
 *     exercise_name: string,
 *     muscle_group: string,
 *     equipment: string,
 *     sets: Array<{ id, set_number, weight_kg, reps, rpe, logged_at }>
 *   }>
 * }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const date = searchParams.get('date');

  if (!userId || !userId.trim()) {
    return NextResponse.json({ error: 'userId is required' }, { status: 401 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Get the workout log for this user+date (take the most recent in_progress or completed)
  const { data: log } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) {
    return NextResponse.json({ workout_log_id: null, exercises: [] });
  }

  const workoutLogId = log.id as string;

  // Fetch all sets with exercise details
  const { data: sets, error } = await supabase
    .from('logged_sets')
    .select(`
      id,
      exercise_id,
      set_number,
      weight_kg,
      reps,
      rpe,
      logged_at,
      exercises (
        name,
        muscle_group,
        equipment
      )
    `)
    .eq('workout_log_id', workoutLogId)
    .order('logged_at', { ascending: true });

  if (error) {
    console.error('Error fetching daily workout log:', error);
    return NextResponse.json({ error: 'Failed to fetch workout log' }, { status: 500 });
  }

  // Group sets by exercise_id
  const exerciseMap = new Map<string, {
    exercise_id: string;
    exercise_name: string;
    muscle_group: string;
    equipment: string;
    sets: Array<{ id: string; set_number: number; weight_kg: number; reps: number; rpe: number | null; logged_at: string }>;
  }>();

  for (const set of (sets ?? [])) {
    const s = set as Record<string, unknown>;
    const ex = s.exercises as { name: string; muscle_group: string; equipment: string } | null;
    const exId = s.exercise_id as string;

    if (!exerciseMap.has(exId)) {
      exerciseMap.set(exId, {
        exercise_id: exId,
        exercise_name: ex?.name ?? 'Unknown',
        muscle_group: ex?.muscle_group ?? '',
        equipment: ex?.equipment ?? '',
        sets: [],
      });
    }

    exerciseMap.get(exId)!.sets.push({
      id: s.id as string,
      set_number: s.set_number as number,
      weight_kg: s.weight_kg as number,
      reps: s.reps as number,
      rpe: s.rpe as number | null,
      logged_at: s.logged_at as string,
    });
  }

  return NextResponse.json({
    workout_log_id: workoutLogId,
    exercises: Array.from(exerciseMap.values()),
  });
}
