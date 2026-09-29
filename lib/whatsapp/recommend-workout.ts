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
    
    if (!data.exercises || data.exercises.length === 0) {
      return `No workout plan available for today. Make sure your profile is set up in the app!`;
    }

    // Build workout message
    let message = `💪 *Today's Workout Plan*\n`;
    message += `${data.muscle_group || 'Full Body'} Day\n\n`;

    data.exercises.slice(0, 5).forEach((exercise: any, index: number) => {
      message += `${index + 1}. *${exercise.exercise_name}*\n`;
      message += `   ${exercise.target_sets} sets × ${exercise.target_reps_min}-${exercise.target_reps_max} reps`;
      
      if (exercise.recommended_weight_kg && exercise.recommended_weight_kg > 0) {
        message += ` @ ${Math.round(exercise.recommended_weight_kg)}kg`;
      }
      message += `\n\n`;
    });

    if (data.exercises.length > 5) {
      message += `_+ ${data.exercises.length - 5} more exercises_\n\n`;
    }

    message += `Open the app to see full details and start tracking! 📱`;

    return message;
  } catch (error) {
    console.error('[WhatsApp Workout Recommendation] Error:', error);
    return `Sorry, I couldn't generate a workout plan right now. Please try again shortly.`;
  }
}
