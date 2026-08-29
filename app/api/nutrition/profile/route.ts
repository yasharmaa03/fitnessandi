import { createServerClient } from '@/lib/supabase/server';
import { computeBmi, getBmiCategory, computeTargets } from '@/lib/nutrition/targets';
import type { ActivityLevel, Goal, CuisineType } from '@/lib/types/nutrition-profile';

// GET: Fetch user profile
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return new Response('userId is required', { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('nutrition_profiles')
    .select('*')
    .eq('user_id', userId.trim())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No profile found
      return new Response('Profile not found', { status: 404 });
    }
    console.error('Profile fetch error:', error);
    return new Response('Failed to fetch profile', { status: 500 });
  }

  return Response.json(data, { status: 200 });
}

// POST: Save or update full nutrition profile
export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const {
    userId,
    age,
    gender,
    height_cm,
    weight_kg,
    activity_level,
    goal,
    cuisine_preference,
  } = body;

  // Validate required fields
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return new Response('userId is required', { status: 400 });
  }

  if (typeof age !== 'number' || age < 1 || age > 120) {
    return new Response('age must be a number between 1 and 120', { status: 400 });
  }

  if (!gender || !['male', 'female', 'other'].includes(gender as string)) {
    return new Response('gender must be male, female, or other', { status: 400 });
  }

  if (typeof height_cm !== 'number' || height_cm < 50 || height_cm > 300) {
    return new Response('height_cm must be a number between 50 and 300', { status: 400 });
  }

  if (typeof weight_kg !== 'number' || weight_kg < 1 || weight_kg > 500) {
    return new Response('weight_kg must be a number between 1 and 500', { status: 400 });
  }

  if (!activity_level || !['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'].includes(activity_level as string)) {
    return new Response('activity_level is invalid', { status: 400 });
  }

  if (!goal || !['lose', 'maintain', 'gain'].includes(goal as string)) {
    return new Response('goal must be lose, maintain, or gain', { status: 400 });
  }

  // Validate cuisine_preference if provided
  if (cuisine_preference !== null && cuisine_preference !== undefined) {
    const validCuisines = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'South Indian', 'North Indian'];
    if (!validCuisines.includes(cuisine_preference as string)) {
      return new Response(`cuisine_preference must be one of: ${validCuisines.join(', ')}`, { status: 400 });
    }
  }

  // Compute BMI and targets
  const bmi = computeBmi(weight_kg as number, height_cm as number);
  const bmi_category = getBmiCategory(bmi);
  const targets = computeTargets(
    weight_kg as number,
    height_cm as number,
    age as number,
    gender as 'male' | 'female' | 'other',
    activity_level as ActivityLevel,
    goal as Goal
  );

  const profileData = {
    user_id: userId,
    age,
    gender,
    height_cm,
    weight_kg,
    activity_level,
    goal,
    bmi,
    bmi_category,
    target_calories: targets.target_calories,
    target_protein_g: targets.target_protein_g,
    target_carbs_g: targets.target_carbs_g,
    target_fat_g: targets.target_fat_g,
    target_water_ml: targets.target_water_ml,
    cuisine_preference: cuisine_preference ?? null,
    updated_at: new Date().toISOString(),
  };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('nutrition_profiles')
    .upsert(profileData, { onConflict: 'user_id' })
    .select()
    .single();

  if (error || !data) {
    console.error('Profile upsert error:', error);
    return new Response('Failed to save profile', { status: 500 });
  }

  return Response.json(data, { status: 200 });
}

// PATCH: Update specific fields like phone_number or cuisine_preference
// PATCH: Update specific fields like phone_number or cuisine_preference
export async function PATCH(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { userId, phoneNumber, cuisinePreference } = body;

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return new Response('userId is required', { status: 400 });
  }

  const updateData: Record<string, unknown> = { user_id: userId };

  // Handle phone number if provided
  if (phoneNumber !== undefined) {
    // Accept any country code (+1, +44, +91, etc.) and tolerate spaces/dashes as typed.
    const normalizedPhone = typeof phoneNumber === 'string' ? phoneNumber.trim().replace(/[\s-]/g, '') : '';

    if (!normalizedPhone || !/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
      return new Response('phoneNumber must be a valid phone number in international format (e.g. +14155551234)', {
        status: 400,
      });
    }
    updateData.phone_number = normalizedPhone;
  }

  // Handle cuisine preference if provided
  if (cuisinePreference !== undefined) {
    if (cuisinePreference !== null) {
      const validCuisines = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'South Indian', 'North Indian'];
      if (!validCuisines.includes(cuisinePreference as string)) {
        return new Response(`cuisinePreference must be one of: ${validCuisines.join(', ')} or null`, {
          status: 400,
        });
      }
    }
    updateData.cuisine_preference = cuisinePreference;
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('nutrition_profiles')
    .upsert(updateData, { onConflict: 'user_id' })
    .select()
    .single();

  if (error || !data) {
    console.error('Profile update error:', error);
    return new Response('Database update failed', { status: 500 });
  }

  return Response.json(data, { status: 200 });
}
