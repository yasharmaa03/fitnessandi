import { generateMealPlanForUser } from '@/lib/nutrition/meal-plan';
import type { MealSuggestion } from '@/lib/types/claude';

export async function handleMealRecommendation(userId: string, mealType?: string): Promise<string> {
  try {
    // Validate meal type if provided
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const normalizedMealType = mealType?.toLowerCase();
    
    if (mealType && !validMealTypes.includes(normalizedMealType!)) {
      return `Invalid meal type. Choose: breakfast, lunch, dinner, or snack`;
    }

    // Generate AI-powered meal recommendations (same as website)
    const suggestions: MealSuggestion[] = await generateMealPlanForUser(userId, {
      mealType: normalizedMealType,
    });

    if (!suggestions || suggestions.length === 0) {
      return `No meal recommendations available. Make sure your profile is set up in the app!`;
    }

    // Build WhatsApp message
    let message = `🍽️ *Meal Recommendations*`;
    if (mealType) {
      message += ` (${mealType.charAt(0).toUpperCase() + mealType.slice(1)})`;
    }
    message += `\n\n`;

    // Show top 3 suggestions
    suggestions.slice(0, 3).forEach((meal, index) => {
      message += `${index + 1}. *${meal.meal_name}*\n`;
      message += `   ${meal.description}\n`;
      message += `   📊 ${Math.round(meal.calories)} kcal | ${Math.round(meal.protein_g)}g protein\n`;
      
      if (meal.items && meal.items.length > 0) {
        message += `   🥘 ${meal.items.slice(0, 3).join(', ')}`;
        if (meal.items.length > 3) {
          message += `, +${meal.items.length - 3} more`;
        }
        message += `\n`;
      }
      message += `\n`;
    });

    if (suggestions.length > 3) {
      message += `_+ ${suggestions.length - 3} more options_\n\n`;
    }

    // Add regenerate and meal type options
    message += `💡 *Try these commands:*\n`;
    message += `• Log it: "breakfast ${suggestions[0].meal_name}"\n`;
    message += `• Regenerate: "recommend meal" or "new meal"\n`;
    message += `• Specific meal: "recommend breakfast/lunch/dinner"\n`;

    return message;
  } catch (error) {
    console.error('[WhatsApp Meal Recommendation] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('profile not found')) {
      return `Please set up your nutrition profile in the app first to get personalized meal recommendations!`;
    }
    
    return `Sorry, I couldn't generate meal recommendations right now. Please try again shortly.`;
  }
}
