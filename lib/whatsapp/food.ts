import { createServerClient } from '@/lib/supabase/server';
import { estimateMacrosFromDescription } from '@/lib/nutrition/describe-meal';
import { insertMealLog } from '@/lib/nutrition/meal-log';
import { getMealTypeForHour } from '@/lib/nutrition/targets';
import type { MealLogRow } from '@/lib/types/meal-log';

const DISCLAIMER = 'This is an approximate estimate and not medical advice.';

async function getTodaysTotals(userId: string, date: string) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('meal_logs')
    .select('calories, protein_g, carbs_g, fat_g')
    .eq('user_id', userId)
    .eq('date', date);

  const mealLogs = (data as Pick<MealLogRow, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[]) ?? [];

  return {
    calories: mealLogs.reduce((sum, row) => sum + (row.calories ?? 0), 0),
    protein_g: mealLogs.reduce((sum, row) => sum + (row.protein_g ?? 0), 0),
    carbs_g: mealLogs.reduce((sum, row) => sum + (row.carbs_g ?? 0), 0),
    fat_g: mealLogs.reduce((sum, row) => sum + (row.fat_g ?? 0), 0),
  };
}

// Parse meal type from message (e.g., "breakfast 2 idlis" or "2 idlis for lunch")
function parseMealType(text: string): { mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null; foodText: string } {
  const normalized = text.toLowerCase().trim();
  
  // Check for patterns like "breakfast 2 eggs" or "2 eggs for breakfast"
  const patterns = [
    { regex: /^breakfast\s+(.+)/i, type: 'breakfast' as const },
    { regex: /^lunch\s+(.+)/i, type: 'lunch' as const },
    { regex: /^dinner\s+(.+)/i, type: 'dinner' as const },
    { regex: /^snack\s+(.+)/i, type: 'snack' as const },
    { regex: /(.+)\s+for\s+breakfast$/i, type: 'breakfast' as const },
    { regex: /(.+)\s+for\s+lunch$/i, type: 'lunch' as const },
    { regex: /(.+)\s+for\s+dinner$/i, type: 'dinner' as const },
    { regex: /(.+)\s+for\s+snack$/i, type: 'snack' as const },
  ];
  
  for (const { regex, type } of patterns) {
    const match = normalized.match(regex);
    if (match) {
      return { mealType: type, foodText: match[1].trim() };
    }
  }
  
  // No meal type specified, return original text
  return { mealType: null, foodText: text };
}

// Treats free-text WhatsApp messages (e.g. "breakfast 2 idlis and sambar") as a food log:
// estimates macros via Groq, stores the log, and replies with today's running total.
export async function handleFoodMessage(userId: string, text: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  // Parse meal type from message
  const { mealType, foodText } = parseMealType(text);
  const finalMealType = mealType || getMealTypeForHour(new Date().getHours());

  let estimate;
  try {
    estimate = await estimateMacrosFromDescription(foodText);
  } catch (error) {
    console.error('[WhatsApp Food] Failed to estimate macros:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Sorry, I couldn't estimate the nutrition for that. Error: ${errorMessage}\n\nTry describing it differently (e.g. "breakfast 2 idlis and sambar"). ${DISCLAIMER}`;
  }

  try {
    await insertMealLog({
      user_id: userId,
      date: today,
      meal_type: finalMealType,
      source: 'description',
      food_name: estimate.meal_name,
      calories: estimate.calories,
      protein_g: estimate.protein_g,
      carbs_g: estimate.carbs_g,
      fat_g: estimate.fat_g,
      fiber_g: estimate.fiber_g,
    });
  } catch (error) {
    console.error('[WhatsApp Food] Failed to insert meal log:', error);
    return `Sorry, I couldn't save that log right now. Please try again shortly. ${DISCLAIMER}`;
  }

  const totals = await getTodaysTotals(userId, today);
  
  const mealTypeEmoji: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍪'
  };

  return (
    `✅ Logged: ${estimate.meal_name}\n` +
    `${mealTypeEmoji[finalMealType]} Meal type: ${finalMealType.charAt(0).toUpperCase() + finalMealType.slice(1)}\n\n` +
    `📊 Today so far:\n` +
    `Calories: ${Math.round(totals.calories)} kcal\n` +
    `Protein: ${Math.round(totals.protein_g)}g\n` +
    `Carbs: ${Math.round(totals.carbs_g)}g\n` +
    `Fat: ${Math.round(totals.fat_g)}g\n\n` +
    DISCLAIMER
  );
}
