export async function handleWorkoutRecommendation(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const mlServiceUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'https://fitnessandi-production.up.railway.app';

  try {
    const response = await fetch(`${mlServiceUrl}/workout/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, date: today }),
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    const data = await response.json();
    
    // Handle rest day
    if (data.workout_type === 'Rest' || !data.recommended_exercises || data.recommended_exercises.length === 0) {
      return `🛌 *Rest Day*\n\nToday is a recovery day! Your body needs rest to grow stronger.\n\n💡 Consider:\n• Light stretching\n• Foam rolling\n• Walking\n• Active recovery\n\nYour next workout will be ready tomorrow! 💪`;
    }

    // Build workout message
    let message = `💪 *${data.workout_type} Day*\n\n`;

    data.recommended_exercises.slice(0, 5).forEach((exercise: any, index: number) => {
      message += `${index + 1}. *${exercise.exercise_name}*\n`;
      message += `   ${exercise.target_sets} sets × ${exercise.target_reps} reps`;
      
      if (exercise.suggested_weight_kg && exercise.suggested_weight_kg > 0) {
        message += ` @ ${Math.round(exercise.suggested_weight_kg)}kg`;
      }
      message += `\n`;
      
      // Add rationale if available (first exercise only for brevity)
      if (index === 0 && exercise.rationale) {
        message += `   💡 ${exercise.rationale}\n`;
      }
      message += `\n`;
    });

    if (data.recommended_exercises.length > 5) {
      message += `_+ ${data.recommended_exercises.length - 5} more exercises_\n\n`;
    }

    // Add workout summary
    if (data.plan_metadata?.estimated_duration_minutes) {
      message += `⏱️ Estimated time: ~${data.plan_metadata.estimated_duration_minutes} min\n`;
    }

    message += `\nStart logging: "bench press 3x10 60kg" 🏋️`;

    return message;
  } catch (error) {
    console.error('[WhatsApp Workout Recommendation] Error:', error);
    return `Sorry, I couldn't generate a workout plan right now. Please try again shortly.`;
  }
}
