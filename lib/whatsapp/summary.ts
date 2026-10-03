import { createServerClient } from '@/lib/supabase/server';
import type { MealLogRow } from '@/lib/types/meal-log';

export async function handleSummaryMessage(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const supabase = createServerClient();

  try {
    // Get nutrition data
    const { data: mealLogs } = await supabase
      .from('meal_logs')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .eq('date', today);

    const meals = (mealLogs as Pick<MealLogRow, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[]) ?? [];
    
    const nutrition = {
      calories: meals.reduce((sum, m) => sum + (m.calories ?? 0), 0),
      protein_g: meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0),
      carbs_g: meals.reduce((sum, m) => sum + (m.carbs_g ?? 0), 0),
      fat_g: meals.reduce((sum, m) => sum + (m.fat_g ?? 0), 0),
    };

    // Get water data
    const { data: waterLogs } = await supabase
      .from('water_logs')
      .select('amount_ml')
      .eq('user_id', userId)
      .eq('date', today);

    const totalWater = (waterLogs ?? []).reduce((sum, w) => sum + (w.amount_ml ?? 0), 0);

    // Get workout data - query workout sessions for today
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select(`
        id,
        date,
        logged_sets(exercise_id, set_number, duration_minutes)
      `)
      .eq('user_id', userId)
      .eq('date', today);

    // Count total exercises and duration
    const workoutCount = workoutLogs?.length ?? 0;
    const totalSets = workoutLogs?.reduce((sum, log: any) => {
      return sum + (log.logged_sets?.length ?? 0);
    }, 0) ?? 0;
    
    const totalDuration = workoutLogs?.reduce((sum, log: any) => {
      return sum + (log.logged_sets?.reduce((s: number, set: any) => s + (set.duration_minutes ?? 0), 0) ?? 0);
    }, 0) ?? 0;

    // Get user targets from nutrition profile
    const { data: profile } = await supabase
      .from('nutrition_profiles')
      .select('target_calories, target_protein_g')
      .eq('user_id', userId)
      .maybeSingle();

    const targetCalories = profile?.target_calories ?? 2000;
    const targetProtein = profile?.target_protein_g ?? 150;
    const targetWater = 2000; // Default 2L

    // Build summary message
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    let message = `📊 *Today's Summary* (${date})\n\n`;
    
    // Nutrition section
    message += `🍽️ *Nutrition:*\n`;
    message += `• Calories: ${Math.round(nutrition.calories)} / ${targetCalories} kcal`;
    message += nutrition.calories >= targetCalories ? ' ✅\n' : '\n';
    message += `• Protein: ${Math.round(nutrition.protein_g)} / ${targetProtein}g`;
    message += nutrition.protein_g >= targetProtein ? ' ✅\n' : '\n';
    message += `• Carbs: ${Math.round(nutrition.carbs_g)}g\n`;
    message += `• Fat: ${Math.round(nutrition.fat_g)}g\n\n`;

    // Water section
    message += `💧 *Water:*\n`;
    message += `• ${totalWater}ml / ${targetWater}ml`;
    message += totalWater >= targetWater ? ' ✅\n\n' : '\n\n';

    // Workout section
    if (workoutCount > 0) {
      message += `💪 *Workout:*\n`;
      message += `• Completed: ${totalSets} set(s) ✅\n`;
      if (totalDuration > 0) {
        message += `• Duration: ${Math.round(totalDuration)} min\n`;
      }
      message += '\n';
    } else {
      message += `💪 *Workout:* No workouts logged today\n\n`;
    }

    message += `Type "help" for more commands`;

    return message;
  } catch (error) {
    console.error('[WhatsApp Summary] Error:', error);
    return `Sorry, I couldn't generate your summary right now. Please try again shortly.`;
  }
}
