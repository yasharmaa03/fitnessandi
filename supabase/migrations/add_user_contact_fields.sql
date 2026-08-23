-- ============================================================================
-- Add phone and email contact fields to nutrition_profiles
-- ============================================================================
-- Supabase auth already stores email in auth.users, but we store a contact
-- email and phone here so they're queryable alongside the fitness profile.
-- ============================================================================

ALTER TABLE nutrition_profiles
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255) DEFAULT NULL;

-- Index for quick lookup by phone (useful for WhatsApp reminders)
CREATE INDEX IF NOT EXISTS idx_nutrition_profiles_phone
  ON nutrition_profiles(phone_number)
  WHERE phone_number IS NOT NULL;
