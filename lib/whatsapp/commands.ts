import { handleFoodMessage } from '@/lib/whatsapp/food';
import { handleWaterMessage, isWaterMessage } from '@/lib/whatsapp/water';
import { handleSummaryMessage } from '@/lib/whatsapp/summary';
import { handleWorkoutMessage, isWorkoutMessage } from '@/lib/whatsapp/workout';
import { handleWorkoutRecommendation } from '@/lib/whatsapp/recommend-workout';
import { handleMealRecommendation } from '@/lib/whatsapp/recommend-meal';

const DISCLAIMER = 'This is an approximate estimate and not medical advice.';

const WELCOME_MESSAGE =
  "Hi! I'm your FitnessAndi assistant 💪\n\n" +
  "I can help you:\n" +
  "• Log meals: \"breakfast 2 eggs and toast\"\n" +
  "• Log water: \"water 500ml\"\n" +
  "• Log workouts: \"30 min running\"\n" +
  "• Get summary: \"summary\"\n" +
  "• Get recommendations: \"recommend meal\" or \"recommend workout\"\n\n" +
  "Type \"help\" for full command list!";

const HELP_MESSAGE =
  '📱 *FitnessAndi Commands*\n\n' +
  '📝 *LOGGING:*\n' +
  '• Meals: "breakfast 2 idlis" or "2 eggs for lunch"\n' +
  '• Water: "water" or "water 500ml"\n' +
  '• Workouts: "30 min running" or "bench press 3x10 60kg"\n\n' +
  '📊 *TRACKING:*\n' +
  '• "summary" - Today\'s nutrition & workout stats\n\n' +
  '💡 *RECOMMENDATIONS:*\n' +
  '• "recommend meal" - AI-powered meal suggestions\n' +
  '• "recommend breakfast/lunch/dinner" - Specific meal\n' +
  '• "new meal" - Regenerate different suggestions\n' +
  '• "recommend workout" - Get today\'s workout plan\n\n' +
  DISCLAIMER;

const NOT_LINKED_MESSAGE =
  'Your WhatsApp number isn\'t linked to a profile yet. Please add this phone number in your ' +
  'profile settings on the app to start logging food and water here.';

// userId is the resolved app user (nutrition_profiles.user_id) for this phone number,
// or null if no profile has linked this number yet.
export async function routeIncomingMessage(text: string, userId: string | null): Promise<string> {
  const normalized = text.trim().toLowerCase();

  if (normalized === 'hi' || normalized === 'hello' || normalized === 'start') {
    return WELCOME_MESSAGE;
  }

  if (normalized === 'help') {
    return HELP_MESSAGE;
  }

  // Everything else (food descriptions, water, summary, workouts) requires a linked profile.
  if (!userId) {
    return NOT_LINKED_MESSAGE;
  }

  // Summary command
  if (normalized === 'summary') {
    return handleSummaryMessage(userId);
  }

  // Workout recommendation
  if (normalized === 'recommend workout' || normalized === 'workout plan' || normalized === 'workout recommendation') {
    return handleWorkoutRecommendation(userId);
  }

  // Meal recommendation - with meal type support
  if (normalized === 'recommend meal' || normalized === 'meal plan' || normalized === 'meal recommendation' || normalized === 'new meal') {
    return handleMealRecommendation(userId);
  }

  // Specific meal type recommendations
  if (normalized === 'recommend breakfast' || normalized === 'breakfast plan') {
    return handleMealRecommendation(userId, 'breakfast');
  }
  if (normalized === 'recommend lunch' || normalized === 'lunch plan') {
    return handleMealRecommendation(userId, 'lunch');
  }
  if (normalized === 'recommend dinner' || normalized === 'dinner plan') {
    return handleMealRecommendation(userId, 'dinner');
  }
  if (normalized === 'recommend snack' || normalized === 'snack plan') {
    return handleMealRecommendation(userId, 'snack');
  }

  // Water logging
  if (isWaterMessage(text)) {
    return handleWaterMessage(userId, text);
  }

  // Workout logging
  if (isWorkoutMessage(text)) {
    return handleWorkoutMessage(userId, text);
  }

  // Default: treat as food description
  return handleFoodMessage(userId, text);
}
