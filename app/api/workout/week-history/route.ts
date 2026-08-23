import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/workout/week-history?userId=...
 * Returns the last 7 days of workout logs with exercise breakdown.
 *
 * Response: Array<{
 *   date: string,
 *   workout_log_id: string,
 *   total_sets: number,
 *   total_volume_kg: number,
 *   exercises: Array<{ exercise_name, muscle_group, sets_count, total_volume_kg }>
 * }>
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId || !userId.trim()) {
    return NextResponse.json({ error: 'userId is required' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Get the last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  // Fetch all workout logs in range
  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select('id, date, status')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (logsError) {
    return NextResponse.json({ error: 'Failed to fetch workout history' }, { status: 500 });
  }

  if (!logs || logs.length === 0) {
    return NextResponse.json({ days: [] });
  }

  // Fetch all sets for those logs
  const logIds = logs.map((l: Record<string, unknown>) => l.id as string);

  const { data: sets, error: setsError } = await supabase
    .from('logged_sets')
    .select(`
      workout_log_id,
      exercise_id,
      set_number,
      weight_kg,
      reps,
      exercises ( name, muscle_group )
    `)
    .in('workout_log_id', logIds);

  if (setsError) {
    return NextResponse.json({ error: 'Failed to fetch set data' }, { status: 500 });
  }

  // Group by log
  const logSetMap = new Map<string, Array<Record<string, unknown>>>();
  for (const set of (sets ?? [])) {
    const s = set as Record<string, unknown>;
    const logId = s.workout_log_id as string;
    if (!logSetMap.has(logId)) logSetMap.set(logId, []);
    logSetMap.get(logId)!.push(s);
  }

  // Build response
  const days = logs.map((log: Record<string, unknown>) => {
    const logId = log.id as string;
    const logSets = logSetMap.get(logId) ?? [];

    // Group sets by exercise
    const exMap = new Map<string, {
      exercise_name: string;
      muscle_group: string;
      sets_count: number;
      total_volume_kg: number;
    }>();

    let totalSets = 0;
    let totalVolume = 0;

    for (const s of logSets) {
      const exId = s.exercise_id as string;
      const ex = s.exercises as { name: string; muscle_group: string } | null;
      const weight = s.weight_kg as number;
      const reps = s.reps as number;
      const vol = weight * reps;

      totalSets++;
      totalVolume += vol;

      if (!exMap.has(exId)) {
        exMap.set(exId, {
          exercise_name: ex?.name ?? 'Unknown',
          muscle_group: ex?.muscle_group ?? '',
          sets_count: 0,
          total_volume_kg: 0,
        });
      }
      const entry = exMap.get(exId)!;
      entry.sets_count++;
      entry.total_volume_kg = Math.round((entry.total_volume_kg + vol) * 100) / 100;
    }

    return {
      date: log.date as string,
      workout_log_id: logId,
      status: log.status as string,
      total_sets: totalSets,
      total_volume_kg: Math.round(totalVolume * 100) / 100,
      exercises: Array.from(exMap.values()),
    };
  });

  return NextResponse.json({ days });
}
