import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/workout/history
 * Returns paginated workout history for a user with aggregated volume metrics.
 * Requirements: 5.1, 5.2, 5.3, 10.7
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limitParam = searchParams.get('limit');

  // Auth check
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Validate limit
  const limit = limitParam !== null ? parseInt(limitParam, 10) : 50;
  if (isNaN(limit) || limit < 1) {
    return NextResponse.json({ error: 'limit must be a positive number' }, { status: 400 });
  }
  if (limit > 200) {
    return NextResponse.json({ error: 'limit must not exceed 200' }, { status: 400 });
  }

  // Validate date format helper
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    return NextResponse.json({ error: 'startDate must be in YYYY-MM-DD format' }, { status: 400 });
  }
  if (endDate && !dateRegex.test(endDate)) {
    return NextResponse.json({ error: 'endDate must be in YYYY-MM-DD format' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Build query — fetch logs with plan name and logged sets for aggregation
  let query = supabase
    .from('workout_logs')
    .select('*, workout_plans(name), logged_sets(weight_kg, reps)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data: logs, error } = await query;

  if (error) {
    console.error('Error fetching workout history:', error);
    return NextResponse.json({ error: 'Failed to fetch workout history' }, { status: 500 });
  }

  // Aggregate volume and set count per workout
  const workouts = (logs ?? []).map((log: Record<string, unknown>) => {
    const sets = (log.logged_sets as Array<{ weight_kg: number; reps: number }>) ?? [];
    const totalVolume = sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
    const setCount = sets.length;

    // Duration: difference between completed_at and started_at in seconds
    let durationSeconds: number | null = null;
    if (log.completed_at && log.started_at) {
      durationSeconds = Math.round(
        (new Date(log.completed_at as string).getTime() -
          new Date(log.started_at as string).getTime()) /
          1000
      );
    }

    const planData = log.workout_plans as { name: string } | null;

    return {
      id: log.id,
      date: log.date,
      plan_name: planData?.name ?? null,
      duration_seconds: durationSeconds,
      total_volume: totalVolume,
      set_count: setCount,
      status: log.status,
    };
  });

  return NextResponse.json({ workouts });
}
