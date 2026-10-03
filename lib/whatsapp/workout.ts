import { createServerClient } from '@/lib/supabase/server';

// Parse workout messages like "30 min running" or "bench press 3x10 60kg"
function parseWorkout(text: string): {
  type: 'cardio' | 'strength';
  exercise: string;
  duration?: number;
  sets?: number;
  reps?: number;
  weight?: number;
} | null {
  const normalized = text.toLowerCase().trim();

  // Cardio pattern: "30 min running" or "45 minutes cycling"
  const cardioMatch = normalized.match(/(\d+)\s*(?:min|minutes?)\s+(.+)/);
  if (cardioMatch) {
    return {
      type: 'cardio',
      exercise: cardioMatch[2].trim(),
      duration: parseInt(cardioMatch[1]),
    };
  }

  // Strength pattern: "bench press 3x10 60kg" or "squat 5 sets 5 reps 100kg"
  const strengthMatch = normalized.match(/(.+?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s+(\d+(?:\.\d+)?)\s*kg)?/);
  if (strengthMatch) {
    return {
      type: 'strength',
      exercise: strengthMatch[1].trim(),
      sets: parseInt(strengthMatch[2]),
      reps: parseInt(strengthMatch[3]),
      weight: strengthMatch[4] ? parseFloat(strengthMatch[4]) : undefined,
    };
  }

  // Alternative strength pattern: "deadlift 5 sets 5 reps 120kg"
  const altStrengthMatch = normalized.match(/(.+?)\s+(\d+)\s+sets?\s+(\d+)\s+reps?(?:\s+(\d+(?:\.\d+)?)\s*kg)?/);
  if (altStrengthMatch) {
    return {
      type: 'strength',
      exercise: altStrengthMatch[1].trim(),
      sets: parseInt(altStrengthMatch[2]),
      reps: parseInt(altStrengthMatch[3]),
      weight: altStrengthMatch[4] ? parseFloat(altStrengthMatch[4]) : undefined,
    };
  }

  return null;
}

export async function handleWorkoutMessage(userId: string, text: string): Promise<string> {
  const workout = parseWorkout(text);

  if (!workout) {
    return (
      `I couldn't understand that workout format. Try:\n\n` +
      `For cardio:\n` +
      `"30 min running"\n` +
      `"45 minutes cycling"\n\n` +
      `For strength:\n` +
      `"bench press 3x10 60kg"\n` +
      `"squat 5 sets 5 reps 100kg"`
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const supabase = createServerClient();

  try {
    // Step 1: Create or get today's workout_log session
    let { data: existingLog } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    let workoutLogId: string;

    if (existingLog) {
      workoutLogId = existingLog.id;
    } else {
      // Create new workout log for today
      const { data: newLog, error: logError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: userId,
          date: today,
          status: 'in_progress',
        })
        .select('id')
        .single();

      if (logError || !newLog) {
        throw new Error('Failed to create workout log');
      }

      workoutLogId = newLog.id;
    }

    // Step 2: Find or create exercise in exercises table
    const { data: existingExercise } = await supabase
      .from('exercises')
      .select('id')
      .ilike('name', workout.exercise)
      .maybeSingle();

    let exerciseId: string;

    if (existingExercise) {
      exerciseId = existingExercise.id;
    } else {
      // Create new exercise
      const { data: newExercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          name: workout.exercise,
          muscle_group: 'full_body', // Default, can be improved
          equipment: workout.type === 'cardio' ? 'none' : 'other',
        })
        .select('id')
        .single();

      if (exerciseError || !newExercise) {
        throw new Error('Failed to create exercise');
      }

      exerciseId = newExercise.id;
    }

    // Step 3: Log the actual set/exercise
    if (workout.type === 'cardio') {
      await supabase.from('logged_sets').insert({
        workout_log_id: workoutLogId,
        exercise_id: exerciseId,
        set_number: 1,
        reps: 0,
        weight_kg: 0,
        duration_minutes: workout.duration,
      });

      // Estimate calories burned (rough estimate: ~10 cal/min for moderate cardio)
      const caloriesBurned = Math.round((workout.duration ?? 0) * 10);

      return (
        `✅ Logged: ${workout.duration} min ${workout.exercise} 🏃\n\n` +
        `Estimated calories burned: ~${caloriesBurned} kcal\n\n` +
        `Great work! Keep it up! 💪`
      );
    } else {
      // Log each set for strength training
      const setPromises = [];
      for (let i = 1; i <= (workout.sets ?? 1); i++) {
        setPromises.push(
          supabase.from('logged_sets').insert({
            workout_log_id: workoutLogId,
            exercise_id: exerciseId,
            set_number: i,
            reps: workout.reps ?? 0,
            weight_kg: workout.weight ?? 0,
          })
        );
      }
      await Promise.all(setPromises);

      let message = `✅ Logged: ${workout.exercise} 💪\n`;
      message += `${workout.sets} sets × ${workout.reps} reps`;
      if (workout.weight) {
        message += ` @ ${workout.weight}kg`;
      }
      message += `\n\nBeast mode! 🔥`;

      return message;
    }
  } catch (error) {
    console.error('[WhatsApp Workout] Failed to log workout:', error);
    return `Sorry, I couldn't log that workout right now. Please try again shortly.`;
  }
}

export function isWorkoutMessage(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  
  // Check if it starts with "workout" or contains workout patterns
  if (normalized.startsWith('workout ')) {
    return true;
  }
  
  // Check for cardio pattern
  if (/\d+\s*(?:min|minutes?)\s+\w+/.test(normalized)) {
    return true;
  }
  
  // Check for strength pattern
  if (/\w+\s+\d+\s*[x×]\s*\d+/.test(normalized) || /\w+\s+\d+\s+sets?\s+\d+\s+reps?/.test(normalized)) {
    return true;
  }
  
  return false;
}
