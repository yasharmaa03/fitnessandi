// ============================================================================
// Workout Tracking - Input Validation Utilities
// ============================================================================
// Validates API request inputs for workout tracking endpoints
// Requirements: 13.3, 13.4, 13.5, 9.4, 9.9
// ============================================================================

import type {
  WorkoutPlanInsert,
  WorkoutSessionInsert,
  LoggedSetInsert,
} from '@/lib/types/workout';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Validation bounds for workout plan inputs
 */
const WORKOUT_PLAN_CONSTRAINTS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 1000,
} as const;

/**
 * Validation bounds for set logging inputs
 */
const SET_CONSTRAINTS = {
  WEIGHT_MIN: 0,
  WEIGHT_MAX: 9999,
  WEIGHT_DECIMALS: 2,
  REPS_MIN: 1,
  REPS_MAX: 999,
  RPE_MIN: 1,
  RPE_MAX: 10,
  RPE_DECIMALS: 1,
} as const;

/**
 * Date format regex: YYYY-MM-DD
 */
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates input for creating a workout plan
 * 
 * Checks:
 * - user_id is non-empty string
 * - name is string with length 1-200 characters
 * - description (if provided) is string with max 1000 characters
 * - exercises is non-empty array with valid exercise objects
 * 
 * @param body - Request body to validate (unknown type for safety)
 * @returns ValidationResult indicating success or failure with error message
 * 
 * **Validates: Requirements 9.3, 9.4**
 */
export function validateWorkoutPlanInput(
  body: unknown
): ValidationResult {
  // Type guard: ensure body is an object
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be a valid object',
    };
  }

  const input = body as Partial<WorkoutPlanInsert>;

  // Validate user_id
  if (!input.user_id || typeof input.user_id !== 'string') {
    return {
      valid: false,
      error: 'user_id is required and must be a string',
    };
  }
  
  if (input.user_id.trim().length === 0) {
    return {
      valid: false,
      error: 'user_id must not be empty',
    };
  }

  // Validate name
  if (!input.name || typeof input.name !== 'string') {
    return {
      valid: false,
      error: 'name is required and must be a string',
    };
  }

  if (
    input.name.length < WORKOUT_PLAN_CONSTRAINTS.NAME_MIN_LENGTH ||
    input.name.length > WORKOUT_PLAN_CONSTRAINTS.NAME_MAX_LENGTH
  ) {
    return {
      valid: false,
      error: `name must be between ${WORKOUT_PLAN_CONSTRAINTS.NAME_MIN_LENGTH} and ${WORKOUT_PLAN_CONSTRAINTS.NAME_MAX_LENGTH} characters`,
    };
  }

  // Validate description (optional)
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== 'string') {
      return {
        valid: false,
        error: 'description must be a string',
      };
    }

    if (input.description.length > WORKOUT_PLAN_CONSTRAINTS.DESCRIPTION_MAX_LENGTH) {
      return {
        valid: false,
        error: `description must not exceed ${WORKOUT_PLAN_CONSTRAINTS.DESCRIPTION_MAX_LENGTH} characters`,
      };
    }
  }

  // Validate exercises array
  if (!input.exercises || !Array.isArray(input.exercises)) {
    return {
      valid: false,
      error: 'exercises is required and must be an array',
    };
  }

  if (input.exercises.length === 0) {
    return {
      valid: false,
      error: 'exercises array must contain at least one exercise',
    };
  }

  // Validate each exercise in the array
  for (let i = 0; i < input.exercises.length; i++) {
    const exercise = input.exercises[i];

    if (!exercise || typeof exercise !== 'object') {
      return {
        valid: false,
        error: `exercises[${i}] must be a valid object`,
      };
    }

    if (!exercise.exercise_id || typeof exercise.exercise_id !== 'string') {
      return {
        valid: false,
        error: `exercises[${i}].exercise_id is required and must be a string`,
      };
    }

    if (typeof exercise.target_sets !== 'number' || !Number.isInteger(exercise.target_sets)) {
      return {
        valid: false,
        error: `exercises[${i}].target_sets must be an integer`,
      };
    }

    if (exercise.target_sets < 1 || exercise.target_sets > 10) {
      return {
        valid: false,
        error: `exercises[${i}].target_sets must be between 1 and 10`,
      };
    }

    if (typeof exercise.target_reps !== 'number' || !Number.isInteger(exercise.target_reps)) {
      return {
        valid: false,
        error: `exercises[${i}].target_reps must be an integer`,
      };
    }

    if (exercise.target_reps < 1 || exercise.target_reps > 999) {
      return {
        valid: false,
        error: `exercises[${i}].target_reps must be between 1 and 999`,
      };
    }

    if (typeof exercise.rest_seconds !== 'number' || !Number.isInteger(exercise.rest_seconds)) {
      return {
        valid: false,
        error: `exercises[${i}].rest_seconds must be an integer`,
      };
    }

    if (exercise.rest_seconds < 0 || exercise.rest_seconds > 600) {
      return {
        valid: false,
        error: `exercises[${i}].rest_seconds must be between 0 and 600`,
      };
    }

    if (typeof exercise.order_index !== 'number' || !Number.isInteger(exercise.order_index)) {
      return {
        valid: false,
        error: `exercises[${i}].order_index must be an integer`,
      };
    }

    if (exercise.order_index < 0) {
      return {
        valid: false,
        error: `exercises[${i}].order_index must be non-negative`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates input for starting a workout session
 * 
 * Checks:
 * - user_id is non-empty string
 * - plan_id is non-empty string
 * - date (if provided) matches YYYY-MM-DD format and is a valid date
 * - notes (if provided) is a string
 * 
 * @param body - Request body to validate (unknown type for safety)
 * @returns ValidationResult indicating success or failure with error message
 * 
 * **Validates: Requirements 9.5, 9.7**
 */
export function validateSessionInput(
  body: unknown
): ValidationResult {
  // Type guard: ensure body is an object
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be a valid object',
    };
  }

  const input = body as Partial<WorkoutSessionInsert>;

  // Validate user_id
  if (!input.user_id || typeof input.user_id !== 'string') {
    return {
      valid: false,
      error: 'user_id is required and must be a string',
    };
  }

  if (input.user_id.trim().length === 0) {
    return {
      valid: false,
      error: 'user_id must not be empty',
    };
  }

  // Validate plan_id
  if (!input.plan_id || typeof input.plan_id !== 'string') {
    return {
      valid: false,
      error: 'plan_id is required and must be a string',
    };
  }

  if (input.plan_id.trim().length === 0) {
    return {
      valid: false,
      error: 'plan_id must not be empty',
    };
  }

  // Validate date (optional, but if provided must be valid)
  if (input.date !== undefined) {
    if (typeof input.date !== 'string') {
      return {
        valid: false,
        error: 'date must be a string',
      };
    }

    if (!DATE_FORMAT_REGEX.test(input.date)) {
      return {
        valid: false,
        error: 'date must be in YYYY-MM-DD format',
      };
    }

    // Validate it's a real date
    const date = new Date(input.date);
    if (isNaN(date.getTime())) {
      return {
        valid: false,
        error: 'date must be a valid date',
      };
    }
  }

  // Validate notes (optional)
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      return {
        valid: false,
        error: 'notes must be a string',
      };
    }
  }

  return { valid: true };
}

/**
 * Validates input for logging a set
 * 
 * Checks:
 * - workout_log_id is non-empty string (using workout_id as field name in input)
 * - exercise_id is non-empty string
 * - weight_kg is number in range [0, 9999] with up to 2 decimal places
 * - reps is integer in range [1, 999]
 * - rpe (if provided) is number in range [1, 10] with up to 1 decimal place
 * - set_number (if provided) is positive integer
 * 
 * @param body - Request body to validate (unknown type for safety)
 * @returns ValidationResult indicating success or failure with error message
 * 
 * **Validates: Requirements 9.8, 9.9, 3.4, 3.5**
 */
export function validateSetInput(
  body: unknown
): ValidationResult {
  // Type guard: ensure body is an object
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be a valid object',
    };
  }

  const input = body as Partial<LoggedSetInsert & { workout_id?: string }>;

  // Validate workout_log_id (may come as workout_id in API)
  const workoutId = input.workout_log_id || (input as any).workout_id;
  if (!workoutId || typeof workoutId !== 'string') {
    return {
      valid: false,
      error: 'workout_id is required and must be a string',
    };
  }

  if (workoutId.trim().length === 0) {
    return {
      valid: false,
      error: 'workout_id must not be empty',
    };
  }

  // Validate exercise_id
  if (!input.exercise_id || typeof input.exercise_id !== 'string') {
    return {
      valid: false,
      error: 'exercise_id is required and must be a string',
    };
  }

  if (input.exercise_id.trim().length === 0) {
    return {
      valid: false,
      error: 'exercise_id must not be empty',
    };
  }

  // Validate weight_kg
  if (input.weight_kg === undefined || input.weight_kg === null) {
    return {
      valid: false,
      error: 'weight_kg is required',
    };
  }

  if (typeof input.weight_kg !== 'number') {
    return {
      valid: false,
      error: 'weight_kg must be a number',
    };
  }

  if (isNaN(input.weight_kg) || !isFinite(input.weight_kg)) {
    return {
      valid: false,
      error: 'weight_kg must be a valid number',
    };
  }

  if (input.weight_kg < SET_CONSTRAINTS.WEIGHT_MIN || input.weight_kg > SET_CONSTRAINTS.WEIGHT_MAX) {
    return {
      valid: false,
      error: `weight_kg must be between ${SET_CONSTRAINTS.WEIGHT_MIN} and ${SET_CONSTRAINTS.WEIGHT_MAX}`,
    };
  }

  // Check decimal places for weight
  const weightDecimals = (input.weight_kg.toString().split('.')[1] || '').length;
  if (weightDecimals > SET_CONSTRAINTS.WEIGHT_DECIMALS) {
    return {
      valid: false,
      error: `weight_kg must have at most ${SET_CONSTRAINTS.WEIGHT_DECIMALS} decimal places`,
    };
  }

  // Validate reps
  if (input.reps === undefined || input.reps === null) {
    return {
      valid: false,
      error: 'reps is required',
    };
  }

  if (typeof input.reps !== 'number') {
    return {
      valid: false,
      error: 'reps must be a number',
    };
  }

  if (!Number.isInteger(input.reps)) {
    return {
      valid: false,
      error: 'reps must be an integer',
    };
  }

  if (input.reps < SET_CONSTRAINTS.REPS_MIN || input.reps > SET_CONSTRAINTS.REPS_MAX) {
    return {
      valid: false,
      error: `reps must be between ${SET_CONSTRAINTS.REPS_MIN} and ${SET_CONSTRAINTS.REPS_MAX}`,
    };
  }

  // Validate rpe (optional)
  if (input.rpe !== undefined && input.rpe !== null) {
    if (typeof input.rpe !== 'number') {
      return {
        valid: false,
        error: 'rpe must be a number',
      };
    }

    if (isNaN(input.rpe) || !isFinite(input.rpe)) {
      return {
        valid: false,
        error: 'rpe must be a valid number',
      };
    }

    if (input.rpe < SET_CONSTRAINTS.RPE_MIN || input.rpe > SET_CONSTRAINTS.RPE_MAX) {
      return {
        valid: false,
        error: `rpe must be between ${SET_CONSTRAINTS.RPE_MIN} and ${SET_CONSTRAINTS.RPE_MAX}`,
      };
    }

    // Check decimal places for RPE
    const rpeDecimals = (input.rpe.toString().split('.')[1] || '').length;
    if (rpeDecimals > SET_CONSTRAINTS.RPE_DECIMALS) {
      return {
        valid: false,
        error: `rpe must have at most ${SET_CONSTRAINTS.RPE_DECIMALS} decimal place`,
      };
    }
  }

  // Validate set_number (optional, but if provided must be positive integer)
  if (input.set_number !== undefined && input.set_number !== null) {
    if (typeof input.set_number !== 'number') {
      return {
        valid: false,
        error: 'set_number must be a number',
      };
    }

    if (!Number.isInteger(input.set_number)) {
      return {
        valid: false,
        error: 'set_number must be an integer',
      };
    }

    if (input.set_number < 1) {
      return {
        valid: false,
        error: 'set_number must be at least 1',
      };
    }
  }

  return { valid: true };
}
