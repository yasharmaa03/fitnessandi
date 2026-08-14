-- ============================================================================
-- Workout Tracking System Migration
-- ============================================================================
-- Creates tables: exercises, workout_plans, plan_exercises, workout_logs, logged_sets
-- Includes: constraints, indexes, RLS policies, triggers
-- Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 18.1, 18.2
-- ============================================================================

-- ============================================================================
-- 1. EXERCISES TABLE
-- ============================================================================
-- Stores the exercise library (seeded from free-exercise-db dataset)
-- Accessible by all authenticated users (read-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL UNIQUE,
  muscle_group VARCHAR(50) NOT NULL 
    CHECK (muscle_group IN ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body')),
  equipment VARCHAR(50) NOT NULL 
    CHECK (equipment IN ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'resistance_band', 'none')),
  instructions TEXT CHECK (char_length(instructions) <= 5000),
  media_url VARCHAR(2048) CHECK (media_url ~ '^https?://'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient exercise queries
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);

-- Enable RLS on exercises
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exercises
-- Authenticated users can SELECT any exercise
CREATE POLICY exercises_select ON exercises 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Only service_role can INSERT/UPDATE/DELETE exercises
CREATE POLICY exercises_insert ON exercises 
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

CREATE POLICY exercises_update ON exercises 
  FOR UPDATE 
  TO service_role
  USING (true);

CREATE POLICY exercises_delete ON exercises 
  FOR DELETE 
  TO service_role
  USING (true);

-- ============================================================================
-- 2. WORKOUT_PLANS TABLE
-- ============================================================================
-- User-created workout routines
-- Users can only access their own plans (RLS enforced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT CHECK (char_length(description) <= 1000),
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient user plan retrieval
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id ON workout_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_is_template ON workout_plans(is_template);

-- Enable RLS on workout_plans
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_plans
-- Users can SELECT only their own plans
CREATE POLICY workout_plans_select ON workout_plans 
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can INSERT only their own plans
CREATE POLICY workout_plans_insert ON workout_plans 
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Users can UPDATE only their own plans
CREATE POLICY workout_plans_update ON workout_plans 
  FOR UPDATE 
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can DELETE only their own plans
CREATE POLICY workout_plans_delete ON workout_plans 
  FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- 3. PLAN_EXERCISES JUNCTION TABLE
-- ============================================================================
-- Links exercises to workout plans with target parameters
-- RLS inherited from workout_plans through plan_id foreign key
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  target_sets INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 10),
  target_reps INTEGER NOT NULL CHECK (target_reps BETWEEN 1 AND 999),
  rest_seconds INTEGER NOT NULL CHECK (rest_seconds BETWEEN 0 AND 600),
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  UNIQUE(plan_id, order_index)
);

-- Indexes for plan_exercises table
CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan_id ON plan_exercises(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_exercises_exercise_id ON plan_exercises(exercise_id);

-- Enable RLS on plan_exercises
ALTER TABLE plan_exercises ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_exercises
-- Users can SELECT plan_exercises if they own the parent workout_plan
CREATE POLICY plan_exercises_select ON plan_exercises 
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_plans 
      WHERE workout_plans.id = plan_exercises.plan_id 
        AND workout_plans.user_id = auth.uid()::text
    )
  );

-- Users can INSERT plan_exercises if they own the parent workout_plan
CREATE POLICY plan_exercises_insert ON plan_exercises 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_plans 
      WHERE workout_plans.id = plan_exercises.plan_id 
        AND workout_plans.user_id = auth.uid()::text
    )
  );

-- Users can UPDATE plan_exercises if they own the parent workout_plan
CREATE POLICY plan_exercises_update ON plan_exercises 
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_plans 
      WHERE workout_plans.id = plan_exercises.plan_id 
        AND workout_plans.user_id = auth.uid()::text
    )
  );

-- Users can DELETE plan_exercises if they own the parent workout_plan
CREATE POLICY plan_exercises_delete ON plan_exercises 
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_plans 
      WHERE workout_plans.id = plan_exercises.plan_id 
        AND workout_plans.user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- 4. WORKOUT_LOGS TABLE
-- ============================================================================
-- Records of workout sessions
-- Users can only access their own logs (RLS enforced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  plan_id UUID REFERENCES workout_plans(id),
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes for workout_logs table
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_status ON workout_logs(status);
CREATE INDEX IF NOT EXISTS idx_workout_logs_plan_id ON workout_logs(plan_id);

-- Enable RLS on workout_logs
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_logs
-- Users can SELECT only their own logs
CREATE POLICY workout_logs_select ON workout_logs 
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can INSERT only their own logs
CREATE POLICY workout_logs_insert ON workout_logs 
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Users can UPDATE only their own logs
CREATE POLICY workout_logs_update ON workout_logs 
  FOR UPDATE 
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can DELETE only their own logs
CREATE POLICY workout_logs_delete ON workout_logs 
  FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- 5. LOGGED_SETS TABLE
-- ============================================================================
-- Individual set performance data
-- RLS inherited from workout_logs through workout_log_id foreign key
-- ============================================================================

CREATE TABLE IF NOT EXISTS logged_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL CHECK (set_number >= 1),
  weight_kg DECIMAL(6, 2) NOT NULL CHECK (weight_kg >= 0 AND weight_kg <= 9999.99),
  reps INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 999),
  rpe DECIMAL(3, 1) CHECK (rpe BETWEEN 1.0 AND 10.0),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for logged_sets table
CREATE INDEX IF NOT EXISTS idx_logged_sets_workout_log_id ON logged_sets(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_logged_sets_exercise_id ON logged_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_logged_sets_logged_at ON logged_sets(logged_at);

-- Enable RLS on logged_sets
ALTER TABLE logged_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for logged_sets
-- Users can SELECT logged_sets if they own the parent workout_log
CREATE POLICY logged_sets_select ON logged_sets 
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs 
      WHERE workout_logs.id = logged_sets.workout_log_id 
        AND workout_logs.user_id = auth.uid()::text
    )
  );

-- Users can INSERT logged_sets if they own the parent workout_log
CREATE POLICY logged_sets_insert ON logged_sets 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_logs 
      WHERE workout_logs.id = logged_sets.workout_log_id 
        AND workout_logs.user_id = auth.uid()::text
    )
  );

-- Users can UPDATE logged_sets if they own the parent workout_log
CREATE POLICY logged_sets_update ON logged_sets 
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs 
      WHERE workout_logs.id = logged_sets.workout_log_id 
        AND workout_logs.user_id = auth.uid()::text
    )
  );

-- Users can DELETE logged_sets if they own the parent workout_log
CREATE POLICY logged_sets_delete ON logged_sets 
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs 
      WHERE workout_logs.id = logged_sets.workout_log_id 
        AND workout_logs.user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workout_plans updated_at
DROP TRIGGER IF EXISTS update_workout_plans_updated_at ON workout_plans;
CREATE TRIGGER update_workout_plans_updated_at
  BEFORE UPDATE ON workout_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, execute the following SQL commands in order:
--
-- DROP TRIGGER IF EXISTS update_workout_plans_updated_at ON workout_plans;
-- DROP TABLE IF EXISTS logged_sets CASCADE;
-- DROP TABLE IF EXISTS workout_logs CASCADE;
-- DROP TABLE IF EXISTS plan_exercises CASCADE;
-- DROP TABLE IF EXISTS workout_plans CASCADE;
-- DROP TABLE IF EXISTS exercises CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
--
-- Note: CASCADE will automatically drop dependent objects (foreign keys, policies, etc.)
-- This will permanently delete all workout tracking data.
-- ============================================================================
