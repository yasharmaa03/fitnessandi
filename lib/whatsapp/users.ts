import { createServerClient } from '@/lib/supabase/server';

// Looks up the app user (email/user_id) linked to a WhatsApp phone number via
// nutrition_profiles.phone_number. Returns null if no profile is linked yet.
export async function resolveUserIdFromPhone(phoneNumber: string): Promise<string | null> {
  const supabase = createServerClient();
  
  console.log('[WhatsApp Users] Looking up phone number:', phoneNumber);
  
  // Normalize the phone number by removing + and any whitespace/dashes
  const normalized = phoneNumber.replace(/[\s\-+]/g, '');
  console.log('[WhatsApp Users] Normalized phone number:', normalized);
  
  // Try exact match first
  let { data } = await supabase
    .from('nutrition_profiles')
    .select('user_id, phone_number')
    .eq('phone_number', phoneNumber)
    .maybeSingle();

  // If no match, try normalized version (without +)
  if (!data) {
    const result = await supabase
      .from('nutrition_profiles')
      .select('user_id, phone_number')
      .eq('phone_number', normalized)
      .maybeSingle();
    data = result.data;
    console.log('[WhatsApp Users] Tried normalized lookup:', { normalized, found: !!data });
  }
  
  // If still no match, try with + prefix
  if (!data && !phoneNumber.startsWith('+')) {
    const withPlus = '+' + normalized;
    const result = await supabase
      .from('nutrition_profiles')
      .select('user_id, phone_number')
      .eq('phone_number', withPlus)
      .maybeSingle();
    data = result.data;
    console.log('[WhatsApp Users] Tried with + prefix:', { withPlus, found: !!data });
  }
  
  // If still no match, try matching the last 10 digits (for cases where country code varies)
  if (!data && normalized.length >= 10) {
    const lastTenDigits = normalized.slice(-10);
    const { data: allProfiles } = await supabase
      .from('nutrition_profiles')
      .select('user_id, phone_number')
      .not('phone_number', 'is', null);
    
    // Find a profile where the last 10 digits match
    const matchingProfile = allProfiles?.find(profile => {
      const profileNormalized = profile.phone_number?.replace(/[\s\-+]/g, '') || '';
      return profileNormalized.slice(-10) === lastTenDigits;
    });
    
    if (matchingProfile) {
      data = matchingProfile;
      console.log('[WhatsApp Users] Found match by last 10 digits:', matchingProfile);
    }
  }

  console.log('[WhatsApp Users] Final result:', data ? `Found user ${data.user_id}` : 'No user found');

  return (data as { user_id: string } | null)?.user_id ?? null;
}
