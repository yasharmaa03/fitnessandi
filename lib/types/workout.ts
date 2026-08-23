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
  date: string;
  status: WorkoutStatus;
  notes: string | null;
  started_at: string;
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
  logged_at: string;
}

// Type guard functions that verify field types and nullability
// Throws TypeError with descriptive messages on validation failure

/**
 * Type guard for ExerciseRow
 * @throws TypeError if validation fails
 */
export function isExerciseRow(data: unknown): data is ExerciseRow {
  if (!data || typeof data !== 'object') {
    throw new TypeError('ExerciseRow validation failed: data must be an object');
  }
  
  const row = data as Record<string, unknown>;
  
  // Validate required string fields
  if (typeof row.id !== 'string') {
    throw new TypeError('ExerciseRow validation failed: id must be a string');
  }
  if (typeof row.name !== 'string') {
    throw new TypeError('ExerciseRow validation failed: name must be a string');
  }
  if (typeof row.created_at !== 'string') {
    throw new TypeError('ExerciseRow validation failed: created_at must be a string');
  }
  
  // Validate muscle_group enum
  const validMuscleGroups: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body'];
  if (typeof row.muscle_group !== 'string' || !validMuscleGroups.includes(row.muscle_group as MuscleGroup)) {
    throw new TypeError(`ExerciseRow validation failed: muscle_group must be one of ${validMuscleGroups.join(', ')}`);
  }
  
  // Validate equipment enum
  const validEquipment: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'resistance_band', 'none'];
  if (typeof row.equipment !== 'string' || !validEquipment.includes(row.equipment as Equipment)) {
    throw new TypeError(`ExerciseRow validation failed: equipment must be one of ${validEquipment.join(', ')}`);
  }
  
  // Validate nullable string fields
  if (row.instructions !== null && typeof row.instructions !== 'string') {
    throw new TypeError('ExerciseRow validation failed: instructions must be a string or null');
  }
  if (row.media_url !== null && typeof row.media_url !== 'string') {
    throw new TypeError('ExerciseRow validation failed: media_url must be a string or null');
  }
  
  return true;
}

/**
 * Type guard for WorkoutPlanRow
 * @throws TypeError if validation fails
 */
export function isWorkoutPlanRow(data: unknown): data is WorkoutPlanRow {
  if (!data || typeof data !== 'object') {
    throw new TypeError('WorkoutPlanRow validation failed: data must be an object');
  }
  
  const row = data as Record<string, unknown>;
  
  // Validate required string fields
  if (typeof row.id !== 'string') {
    throw new TypeError('WorkoutPlanRow validation failed: id must be a string');
  }
  if (typeof row.user_id !== 'string') {
    throw new TypeError('WorkoutPlanRow validation failed: user_id must be a string');
  }
  if (typeof row.name !== 'string') {
    throw new TypeError('WorkoutPlanRow validation failed: name must be a string');
  }
  if (typeof row.created_at !== 'string') {
    throw new TypeError('WorkoutPlanRow validation failed: created_at must be a string');
  }
  if (typeof row.updated_at !== 'string') {
    throw new TypeError('WorkoutPlanRow validation failed: updated_at must be a string');
  }
  
  // Validate boolean field
  if (typeof row.is_template !== 'boolean') {
    throw new TypeError('WorkoutPlanRow validation failed: is_template must be a boolean');
  }
  
  // Validate nullable string field
  if (row.description !== null && typeof row.description !== 'string') {
    throw new TypeError('WorkoutPlanRow validation failed: description must be a string or null');
  }
  
  return true;
}

/**
 * Type guard for WorkoutLogRow
 * @throws TypeError if validation fails
 */
export function isWorkoutLogRow(data: unknown): data is WorkoutLogRow {
  if (!data || typeof data !== 'object') {
    throw new TypeError('WorkoutLogRow validation failed: data must be an object');
  }
  
  const row = data as Record<string, unknown>;
  
  // Validate required string fields
  if (typeof row.id !== 'string') {
    throw new TypeError('WorkoutLogRow validation failed: id must be a string');
  }
  if (typeof row.user_id !== 'string') {
    throw new TypeError('WorkoutLogRow validation failed: user_id must be a string');
  }
  if (typeof row.date !== 'string') {
    throw new TypeError('WorkoutLogRow validation failed: date must be a string');
  }
  if (typeof row.started_at !== 'string') {
    throw new TypeError('WorkoutLogRow validation failed: started_at must be a string');
  }
  
  // Validate status enum
  const validStatuses: WorkoutStatus[] = ['in_progress', 'completed', 'abandoned'];
  if (typeof row.status !== 'string' || !validStatuses.includes(row.status as WorkoutStatus)) {
    throw new TypeError(`WorkoutLogRow validation failed: status must be one of ${validStatuses.join(', ')}`);
  }
  
  // Validate nullable string fields
  if (row.plan_id !== null && typeof row.plan_id !== 'string') {
    throw new TypeError('WorkoutLogRow validation failed: plan_id must be a string or null');
  }
  if (row.notes !== null && typeof row.notes !== 'string') {
    throw new TypeError('WorkoutLogRow validation failed: notes must be a string or null');
  }
  if (row.completed_at !== null && typeof row.completed_at !== 'string') {
    throw new TypeError('WorkoutLogRow validation failed: completed_at must be a string or null');
  }
  
  return true;
}

/**
 * Type guard for LoggedSetRow
 * @throws TypeError if validation fails
 */
export function isLoggedSetRow(data: unknown): data is LoggedSetRow {
  if (!data || typeof data !== 'object') {
    throw new TypeError('LoggedSetRow validation failed: data must be an object');
  }
  
  const row = data as Record<string, unknown>;
  
  // Validate required string fields
  if (typeof row.id !== 'string') {
    throw new TypeError('LoggedSetRow validation failed: id must be a string');
  }
  if (typeof row.workout_log_id !== 'string') {
    throw new TypeError('LoggedSetRow validation failed: workout_log_id must be a string');
  }
  if (typeof row.exercise_id !== 'string') {
    throw new TypeError('LoggedSetRow validation failed: exercise_id must be a string');
  }
  if (typeof row.logged_at !== 'string') {
    throw new TypeError('LoggedSetRow validation failed: logged_at must be a string');
  }
  
  // Validate required number fields
  if (typeof row.set_number !== 'number') {
    throw new TypeError('LoggedSetRow validation failed: set_number must be a number');
  }
  if (typeof row.weight_kg !== 'number') {
    throw new TypeError('LoggedSetRow validation failed: weight_kg must be a number');
  }
  if (typeof row.reps !== 'number') {
    throw new TypeError('LoggedSetRow validation failed: reps must be a number');
  }
  
  // Validate nullable number field
  if (row.rpe !== null && typeof row.rpe !== 'number') {
    throw new TypeError('LoggedSetRow validation failed: rpe must be a number or null');
  }
  
  return true;
}

// Insert types for creating new records
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

// Validation result type
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates WorkoutPlanInsert input
 * Checks required fields, field types, and value bounds
 * 
 * Requirements: 13.3, 13.4, 13.5, 9.4, 9.9
 */
export function validateWorkoutPlanInput(input: unknown): ValidationResult {
  // Check if input is an object
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Input must be an object' };
  }
  
  const data = input as Record<string, unknown>;
  
  // Validate user_id (required, non-empty string)
  if (!data.user_id || typeof data.user_id !== 'string' || data.user_id.trim() === '') {
    return { valid: false, error: 'user_id is required and must be a non-empty string' };
  }
  
  // Validate name (required, 1-200 characters)
  if (!data.name || typeof data.name !== 'string') {
    return { valid: false, error: 'name is required and must be a string' };
  }
  if (data.name.length < 1 || data.name.length > 200) {
    return { valid: false, error: 'name must be between 1 and 200 characters' };
  }
  
  // Validate description (optional, 0-1000 characters)
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      return { valid: false, error: 'description must be a string' };
    }
    if (data.description.length > 1000) {
      return { valid: false, error: 'description must not exceed 1000 characters' };
    }
  }
  
  // Validate exercises array (required, at least one exercise)
  if (!data.exercises || !Array.isArray(data.exercises)) {
    return { valid: false, error: 'exercises is required and must be an array' };
  }
  if (data.exercises.length === 0) {
    return { valid: false, error: 'exercises array must contain at least one exercise' };
  }
  
  // Validate each exercise in the array
  for (let i = 0; i < data.exercises.length; i++) {
    const exercise = data.exercises[i];
    
    if (!exercise || typeof exercise !== 'object') {
      return { valid: false, error: `exercises[${i}] must be an object` };
    }
    
    const ex = exercise as Record<string, unknown>;
    
    // Validate exercise_id
    if (!ex.exercise_id || typeof ex.exercise_id !== 'string' || ex.exercise_id.trim() === '') {
      return { valid: false, error: `exercises[${i}].exercise_id is required and must be a non-empty string` };
    }
    
    // Validate target_sets (1-10)
    if (typeof ex.target_sets !== 'number' || !Number.isInteger(ex.target_sets)) {
      return { valid: false, error: `exercises[${i}].target_sets must be an integer` };
    }
    if (ex.target_sets < 1 || ex.target_sets > 10) {
      return { valid: false, error: `exercises[${i}].target_sets must be between 1 and 10` };
    }
    
    // Validate target_reps (1-999)
    if (typeof ex.target_reps !== 'number' || !Number.isInteger(ex.target_reps)) {
      return { valid: false, error: `exercises[${i}].target_reps must be an integer` };
    }
    if (ex.target_reps < 1 || ex.target_reps > 999) {
      return { valid: false, error: `exercises[${i}].target_reps must be between 1 and 999` };
    }
    
    // Validate rest_seconds (0-600)
    if (typeof ex.rest_seconds !== 'number' || !Number.isInteger(ex.rest_seconds)) {
      return { valid: false, error: `exercises[${i}].rest_seconds must be an integer` };
    }
    if (ex.rest_seconds < 0 || ex.rest_seconds > 600) {
      return { valid: false, error: `exercises[${i}].rest_seconds must be between 0 and 600` };
    }
    
    // Validate order_index (>= 0)
    if (typeof ex.order_index !== 'number' || !Number.isInteger(ex.order_index)) {
      return { valid: false, error: `exercises[${i}].order_index must be an integer` };
    }
    if (ex.order_index < 0) {
      return { valid: false, error: `exercises[${i}].order_index must be greater than or equal to 0` };
    }
  }
  
  return { valid: true };
}

/**
 * Validates WorkoutSessionInsert input
 * Checks required fields, field types, and value bounds
 * 
 * Requirements: 13.3, 13.4, 13.5, 9.4, 9.9
 */
export function validateSessionInput(input: unknown): ValidationResult {
  // Check if input is an object
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Input must be an object' };
  }
  
  const data = input as Record<string, unknown>;
  
  // Validate user_id (required, non-empty string)
  if (!data.user_id || typeof data.user_id !== 'string' || data.user_id.trim() === '') {
    return { valid: false, error: 'user_id is required and must be a non-empty string' };
  }
  
  // Validate plan_id (required, non-empty string)
  if (!data.plan_id || typeof data.plan_id !== 'string' || data.plan_id.trim() === '') {
    return { valid: false, error: 'plan_id is required and must be a non-empty string' };
  }
  
  // Validate date (required, YYYY-MM-DD format)
  if (!data.date || typeof data.date !== 'string') {
    return { valid: false, error: 'date is required and must be a string' };
  }
  // Check YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.date)) {
    return { valid: false, error: 'date must be in YYYY-MM-DD format' };
  }
  
  // Validate notes (optional, string)
  if (data.notes !== undefined && typeof data.notes !== 'string') {
    return { valid: false, error: 'notes must be a string' };
  }
  
  return { valid: true };
}

/**
 * Validates LoggedSetInsert input
 * Checks required fields, field types, and value bounds
 * 
 * Requirements: 13.3, 13.4, 13.5, 9.4, 9.9
 */
export function validateSetInput(input: unknown): ValidationResult {
  // Check if input is an object
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Input must be an object' };
  }
  
  const data = input as Record<string, unknown>;
  
  // Validate workout_log_id (required, non-empty string)
  if (!data.workout_log_id || typeof data.workout_log_id !== 'string' || data.workout_log_id.trim() === '') {
    return { valid: false, error: 'workout_log_id is required and must be a non-empty string' };
  }
  
  // Validate exercise_id (required, non-empty string)
  if (!data.exercise_id || typeof data.exercise_id !== 'string' || data.exercise_id.trim() === '') {
    return { valid: false, error: 'exercise_id is required and must be a non-empty string' };
  }
  
  // Validate set_number (required, positive integer)
  if (typeof data.set_number !== 'number' || !Number.isInteger(data.set_number)) {
    return { valid: false, error: 'set_number must be an integer' };
  }
  if (data.set_number < 1) {
    return { valid: false, error: 'set_number must be at least 1' };
  }
  
  // Validate weight_kg (required, 0-9999, up to 2 decimals)
  if (typeof data.weight_kg !== 'number') {
    return { valid: false, error: 'weight_kg must be a number' };
  }
  if (data.weight_kg < 0 || data.weight_kg > 9999) {
    return { valid: false, error: 'weight_kg must be between 0 and 9999' };
  }
  // Check decimal places (up to 2)
  const weightStr = data.weight_kg.toString();
  if (weightStr.includes('.')) {
    const decimalPlaces = weightStr.split('.')[1].length;
    if (decimalPlaces > 2) {
      return { valid: false, error: 'weight_kg must have at most 2 decimal places' };
    }
  }
  
  // Validate reps (required, 1-999)
  if (typeof data.reps !== 'number' || !Number.isInteger(data.reps)) {
    return { valid: false, error: 'reps must be an integer' };
  }
  if (data.reps < 1 || data.reps > 999) {
    return { valid: false, error: 'reps must be between 1 and 999' };
  }
  
  // Validate rpe (optional, 1-10, up to 1 decimal)
  if (data.rpe !== undefined && data.rpe !== null) {
    if (typeof data.rpe !== 'number') {
      return { valid: false, error: 'rpe must be a number' };
    }
    if (data.rpe < 1 || data.rpe > 10) {
      return { valid: false, error: 'rpe must be between 1 and 10' };
    }
    // Check decimal places (up to 1)
    const rpeStr = data.rpe.toString();
    if (rpeStr.includes('.')) {
      const decimalPlaces = rpeStr.split('.')[1].length;
      if (decimalPlaces > 1) {
        return { valid: false, error: 'rpe must have at most 1 decimal place' };
      }
    }
  }
  
  return { valid: true };
}
