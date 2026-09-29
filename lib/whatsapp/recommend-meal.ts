import { createServerClient } from '@/lib/supabase/server';
import type { MealLogRow } from '@/lib/types/meal-log';

export async function handleMealRecommendation(userId: string): Promise<string> {
  const supabase = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  try {
    // Get user's nutrition profile and targets
    const { data: profile } = await supabase
      .from('nutrition_profiles')
      .select('target_calories, target_protein_g, target_carbs_g, target_fat_g, cuisine_preference')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) {
      return `Please set up your nutrition profile in the app first to get personalized meal recommendations!`;
    }

    // Get today's consumed nutrition
    const { data: mealLogs } = await supabase
      .from('meal_logs')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .eq('date', today);

    const meals = (mealLogs as Pick<MealLogRow, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[]) ?? [];
    
    const consumed = {
      calories: meals.reduce((sum, m) => sum + (m.calories ?? 0), 0),
      protein_g: meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0),
      carbs_g: meals.reduce((sum, m) => sum + (m.carbs_g ?? 0), 0),
      fat_g: meals.reduce((sum, m) => sum + (m.fat_g ?? 0), 0),
    };

    const remaining = {
      calories: (profile.target_calories ?? 2000) - consumed.calories,
      protein_g: (profile.target_protein_g ?? 150) - consumed.protein_g,
      carbs_g: (profile.target_carbs_g ?? 200) - consumed.carbs_g,
      fat_g: (profile.target_fat_g ?? 60) - consumed.fat_g,
    };

    // Determine meal size based on remaining calories
    const mealSize = remaining.calories > 600 ? 'large' : remaining.calories > 350 ? 'medium' : 'small';

    // Generate meal suggestions based on cuisine preference and remaining macros
    const cuisine = profile.cuisine_preference || 'Any';
    
    let message = `🍽️ *Meal Recommendations*\n\n`;
    message += `Based on your remaining macros:\n`;
    message += `• Calories: ${Math.round(remaining.calories)} kcal\n`;
    message += `• Protein: ${Math.round(remaining.protein_g)}g\n\n`;

    // Provide 3 meal suggestions
    const suggestions = getMealSuggestions(cuisine, mealSize, remaining.calories, remaining.protein_g);
    
    suggestions.forEach((meal, index) => {
      message += `${index + 1}. *${meal.name}*\n`;
      message += `   ~${meal.calories} kcal | ${meal.protein}g protein\n\n`;
    });

    message += `Log it by typing: "${suggestions[0].name}"`;

    return message;
  } catch (error) {
    console.error('[WhatsApp Meal Recommendation] Error:', error);
    return `Sorry, I couldn't generate meal recommendations right now. Please try again shortly.`;
  }
}

// Helper function to generate meal suggestions
function getMealSuggestions(
  cuisine: string, 
  size: 'small' | 'medium' | 'large',
  targetCalories: number,
  targetProtein: number
): Array<{ name: string; calories: number; protein: number }> {
  
  const mealDatabase: Record<string, Array<{ name: string; calories: number; protein: number }>> = {
    'South Indian': [
      { name: 'Grilled Fish with Sambar', calories: 380, protein: 42 },
      { name: 'Paneer Tikka with Roti', calories: 420, protein: 28 },
      { name: 'Chicken Curry with Brown Rice', calories: 480, protein: 38 },
      { name: 'Dal Khichdi with Yogurt', calories: 350, protein: 18 },
      { name: 'Idli with Egg Curry', calories: 320, protein: 22 },
    ],
    'North Indian': [
      { name: 'Chicken Tikka Masala with Naan', calories: 520, protein: 35 },
      { name: 'Rajma Chawal', calories: 420, protein: 20 },
      { name: 'Paneer Butter Masala with Roti', calories: 450, protein: 24 },
      { name: 'Chole Bhature (small)', calories: 380, protein: 16 },
      { name: 'Dal Makhani with Rice', calories: 400, protein: 18 },
    ],
    'Mediterranean': [
      { name: 'Grilled Chicken Greek Salad', calories: 380, protein: 40 },
      { name: 'Falafel Wrap with Hummus', calories: 420, protein: 22 },
      { name: 'Grilled Salmon with Vegetables', calories: 450, protein: 42 },
      { name: 'Shakshuka with Whole Wheat Pita', calories: 360, protein: 20 },
    ],
    'Any': [
      { name: 'Grilled Chicken Salad', calories: 350, protein: 38 },
      { name: 'Tuna Sandwich (whole wheat)', calories: 380, protein: 28 },
      { name: 'Vegetable Stir-fry with Tofu', calories: 320, protein: 22 },
      { name: 'Greek Yogurt Bowl with Fruits & Nuts', calories: 280, protein: 20 },
      { name: 'Egg White Omelette with Veggies', calories: 250, protein: 24 },
    ],
  };

  const meals = mealDatabase[cuisine] || mealDatabase['Any'];
  
  // Filter meals based on size
  const filtered = meals.filter(meal => {
    if (size === 'small') return meal.calories <= 350;
    if (size === 'medium') return meal.calories > 350 && meal.calories <= 500;
    return meal.calories > 500;
  });

  // Return top 3 suggestions, prioritizing protein content
  return (filtered.length > 0 ? filtered : meals)
    .sort((a, b) => b.protein - a.protein)
    .slice(0, 3);
}
