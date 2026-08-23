import { describe, it, expect } from 'vitest';
import {
  validateWorkoutPlanInput,
  validateSessionInput,
  validateSetInput,
} from '../workout';

describe('validateWorkoutPlanInput', () => {
  it('should accept valid workout plan input', () => {
    const validInput = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      description: 'A great workout plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(validInput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject missing user_id', () => {
    const input = {
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('user_id');
  });

  it('should reject empty user_id', () => {
    const input = {
      user_id: '  ',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('user_id');
  });

  it('should reject missing name', () => {
    const input = {
      user_id: 'user-123',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
  });

  it('should reject name exceeding 200 characters', () => {
    const input = {
      user_id: 'user-123',
      name: 'a'.repeat(201),
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
    expect(result.error).toContain('200');
  });

  it('should reject description exceeding 1000 characters', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      description: 'a'.repeat(1001),
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('description');
    expect(result.error).toContain('1000');
  });

  it('should reject empty exercises array', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exercises');
    expect(result.error).toContain('at least one');
  });

  it('should reject target_sets below 1', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 0,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('target_sets');
    expect(result.error).toContain('1 and 10');
  });

  it('should reject target_sets above 10', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 11,
          target_reps: 10,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('target_sets');
    expect(result.error).toContain('1 and 10');
  });

  it('should reject target_reps below 1', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 0,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('target_reps');
    expect(result.error).toContain('1 and 999');
  });

  it('should reject target_reps above 999', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 1000,
          rest_seconds: 60,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('target_reps');
    expect(result.error).toContain('1 and 999');
  });

  it('should reject rest_seconds below 0', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: -1,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('rest_seconds');
    expect(result.error).toContain('0 and 600');
  });

  it('should reject rest_seconds above 600', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 601,
          order_index: 0,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('rest_seconds');
    expect(result.error).toContain('0 and 600');
  });

  it('should reject negative order_index', () => {
    const input = {
      user_id: 'user-123',
      name: 'My Workout Plan',
      exercises: [
        {
          exercise_id: 'exercise-1',
          target_sets: 3,
          target_reps: 10,
          rest_seconds: 60,
          order_index: -1,
        },
      ],
    };
    
    const result = validateWorkoutPlanInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('order_index');
  });
});

describe('validateSessionInput', () => {
  it('should accept valid session input', () => {
    const validInput = {
      user_id: 'user-123',
      plan_id: 'plan-456',
      date: '2024-01-15',
      notes: 'Great workout',
    };
    
    const result = validateSessionInput(validInput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept valid session input without notes', () => {
    const validInput = {
      user_id: 'user-123',
      plan_id: 'plan-456',
      date: '2024-01-15',
    };
    
    const result = validateSessionInput(validInput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject missing user_id', () => {
    const input = {
      plan_id: 'plan-456',
      date: '2024-01-15',
    };
    
    const result = validateSessionInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('user_id');
  });

  it('should reject empty user_id', () => {
    const input = {
      user_id: '  ',
      plan_id: 'plan-456',
      date: '2024-01-15',
    };
    
    const result = validateSessionInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('user_id');
  });

  it('should reject missing plan_id', () => {
    const input = {
      user_id: 'user-123',
      date: '2024-01-15',
    };
    
    const result = validateSessionInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('plan_id');
  });

  it('should reject empty plan_id', () => {
    const input = {
      user_id: 'user-123',
      plan_id: '  ',
      date: '2024-01-15',
    };
    
    const result = validateSessionInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('plan_id');
  });

  it('should reject missing date', () => {
    const input = {
      user_id: 'user-123',
      plan_id: 'plan-456',
    };
    
    const result = validateSessionInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('date');
  });

  it('should reject invalid date format', () => {
    const input = {
      user_id: 'user-123',
      plan_id: 'plan-456',
      date: '01/15/2024',
    };
    
    const result = validateSessionInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('date');
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('should reject non-string notes', () => {
    const input = {
      user_id: 'user-123',
      plan_id: 'plan-456',
      date: '2024-01-15',
      notes: 123,
    };
    
    const result = validateSessionInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('notes');
  });
});

describe('validateSetInput', () => {
  it('should accept valid set input with rpe', () => {
    const validInput = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100.5,
      reps: 10,
      rpe: 7.5,
    };
    
    const result = validateSetInput(validInput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept valid set input without rpe', () => {
    const validInput = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100.5,
      reps: 10,
    };
    
    const result = validateSetInput(validInput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject missing workout_log_id', () => {
    const input = {
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100,
      reps: 10,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('workout_log_id');
  });

  it('should reject empty workout_log_id', () => {
    const input = {
      workout_log_id: '  ',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100,
      reps: 10,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('workout_log_id');
  });

  it('should reject missing exercise_id', () => {
    const input = {
      workout_log_id: 'log-123',
      set_number: 1,
      weight_kg: 100,
      reps: 10,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exercise_id');
  });

  it('should reject weight_kg below 0', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: -1,
      reps: 10,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('weight_kg');
    expect(result.error).toContain('0 and 9999');
  });

  it('should reject weight_kg above 9999', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 10000,
      reps: 10,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('weight_kg');
    expect(result.error).toContain('0 and 9999');
  });

  it('should reject weight_kg with more than 2 decimal places', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100.123,
      reps: 10,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('weight_kg');
    expect(result.error).toContain('2 decimal places');
  });

  it('should reject reps below 1', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100,
      reps: 0,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reps');
    expect(result.error).toContain('1 and 999');
  });

  it('should reject reps above 999', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100,
      reps: 1000,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reps');
    expect(result.error).toContain('1 and 999');
  });

  it('should reject rpe below 1', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100,
      reps: 10,
      rpe: 0.5,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('rpe');
    expect(result.error).toContain('1 and 10');
  });

  it('should reject rpe above 10', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100,
      reps: 10,
      rpe: 10.5,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('rpe');
    expect(result.error).toContain('1 and 10');
  });

  it('should reject rpe with more than 1 decimal place', () => {
    const input = {
      workout_log_id: 'log-123',
      exercise_id: 'exercise-456',
      set_number: 1,
      weight_kg: 100,
      reps: 10,
      rpe: 7.55,
    };
    
    const result = validateSetInput(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('rpe');
    expect(result.error).toContain('1 decimal place');
  });

  it('should accept boundary values', () => {
    const validInputs = [
      {
        workout_log_id: 'log-123',
        exercise_id: 'exercise-456',
        set_number: 1,
        weight_kg: 0,
        reps: 1,
        rpe: 1,
      },
      {
        workout_log_id: 'log-123',
        exercise_id: 'exercise-456',
        set_number: 1,
        weight_kg: 9999,
        reps: 999,
        rpe: 10,
      },
      {
        workout_log_id: 'log-123',
        exercise_id: 'exercise-456',
        set_number: 1,
        weight_kg: 99.99,
        reps: 500,
        rpe: 5.5,
      },
    ];

    validInputs.forEach((input) => {
      const result = validateSetInput(input);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
