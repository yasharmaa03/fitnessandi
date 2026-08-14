// TypeScript types for workout tracking system

export type MuscleGroup = 
  | 'chest' 
  | 'back' 
  | 'legs' 
  | 'shoulders' 
  | 'arms' 
  | 'core' 
  | 'full_body';

export type Equipment = 
  | 'barbell' 
  | 'dumbbell' 
  | 'machine' 
  | 'cable' 
  | 'bodyweight' 
  | 'resistance_band' 
  | 'none';

export type WorkoutStatus = 
  | 'in_progress' 
  | 'completed' 
  | 'abandoned';

export interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  instructions: string | null;
  media_url: string | null;
  created_at: string;
}

export interface WorkoutPlanRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanExerciseRow {
  id: string;
  plan_id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  rest_seconds: number;
  order_index: number;
}

export interface WorkoutLogRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  date: string;              // YYYY-MM-DD
  status: WorkoutStatus;
  notes: string | null;
  started_at: string;        // ISO-8601
  completed_at: string | null;
}

export interface LoggedSetRow {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  logged_at: string;         // ISO-8601
}

export interface WorkoutPlanInsert {
  user_id: string;
  name: string;
  description?: string;
  exercises: Array<{
    exercise_id: string;
    target_sets: number;
    target_reps: number;
    rest_seconds: number;
    order_index: number;
  }>;
}

export interface WorkoutSessionInsert {
  user_id: string;
  plan_id: string;
  date: string;
  notes?: string;
}

export interface LoggedSetInsert {
  workout_log_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe?: number;
}
