// ============================================================================
// Weekly Plan Retrieval Integration Tests
// ============================================================================
// Tests for GET /api/workout/weekly-plan endpoint
// Task 10 validation tests
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/weekly-planner/db', () => ({
  getWeeklyPlan: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, public operation: string, public originalError?: unknown) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

describe('GET /api/workout/weekly-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should return 400 VALIDATION_ERROR for missing user_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('user_id');
      expect(data.details.errors).toContain('user_id is required');
    });

    it('should return 400 VALIDATION_ERROR for empty user_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=   ');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR for invalid date format', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user&week_start_date=01/27/2025');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('date format');
    });

    it('should accept valid YYYY-MM-DD date format', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getWeeklyPlan).mockResolvedValue(null);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user&week_start_date=2025-01-27');

      const response = await GET(request);

      // Should pass validation (will return 404 since plan doesn't exist in mock)
      expect(response.status).toBe(404);
    });
  });

  describe('Specific Week Retrieval - Requirement 5.2', () => {
    it('should return exact match when week_start_date is provided', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockPlan = {
        id: 'plan-123',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
        plan_days: Array.from({ length: 7 }, (_, i) => ({
          id: `day-${i}`,
          weekly_plan_id: 'plan-123',
          day_index: i,
          workout_type: 'Push',
          estimated_duration_minutes: 45,
          focus_muscle_groups: ['chest'],
          adherence_status: 'not_started' as const,
          completed_at: null,
          created_at: '2025-01-27T10:00:00Z',
          exercises: [],
        })),
        plan_metadata: {
          total_weekly_duration_minutes: 315,
        },
      };

      vi.mocked(getWeeklyPlan).mockResolvedValue(mockPlan as any);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user&week_start_date=2025-01-27');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.week_start_date).toBe('2025-01-27');
      expect(getWeeklyPlan).toHaveBeenCalledWith(
        expect.anything(),
        'test-user',
        '2025-01-27'
      );
    });
  });

  describe('Most Recent Plan Retrieval - Requirement 5.3', () => {
    it('should return most recent plan when week_start_date is omitted', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockRecentPlan = {
        id: 'plan-456',
        user_id: 'test-user',
        week_start_date: '2025-02-03', // Most recent week
        created_at: '2025-02-03T10:00:00Z',
        updated_at: '2025-02-03T10:00:00Z',
        plan_days: Array.from({ length: 7 }, (_, i) => ({
          id: `day-${i}`,
          weekly_plan_id: 'plan-456',
          day_index: i,
          workout_type: 'Push',
          estimated_duration_minutes: 45,
          focus_muscle_groups: ['chest'],
          adherence_status: 'not_started' as const,
          completed_at: null,
          created_at: '2025-02-03T10:00:00Z',
          exercises: [],
        })),
        plan_metadata: {
          total_weekly_duration_minutes: 315,
        },
      };

      vi.mocked(getWeeklyPlan).mockResolvedValue(mockRecentPlan as any);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.week_start_date).toBe('2025-02-03');
      
      // Verify getWeeklyPlan was called without week_start_date
      expect(getWeeklyPlan).toHaveBeenCalledWith(
        expect.anything(),
        'test-user',
        undefined
      );
    });
  });

  describe('No Plan Found - Requirement 5.4', () => {
    it('should return 404 NO_PLAN_FOUND when no plan exists for specific week', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getWeeklyPlan).mockResolvedValue(null);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user&week_start_date=2025-01-27');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NO_PLAN_FOUND');
      expect(data.error).toContain('2025-01-27');
      expect(data.details.user_id).toBe('test-user');
      expect(data.details.week_start_date).toBe('2025-01-27');
    });

    it('should return 404 NO_PLAN_FOUND when user has no plans at all', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getWeeklyPlan).mockResolvedValue(null);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=new-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NO_PLAN_FOUND');
      expect(data.error).toContain('No plans found');
    });
  });

  describe('Complete Weekly Structure - Requirements 5.5, 5.6, 5.7, 5.9, 5.10', () => {
    it('should return exactly 7 plan days ordered by day_index', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockPlan = {
        id: 'plan-123',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
        plan_days: Array.from({ length: 7 }, (_, i) => ({
          id: `day-${i}`,
          weekly_plan_id: 'plan-123',
          day_index: i,
          workout_type: i === 6 ? 'rest' : 'Push',
          estimated_duration_minutes: i === 6 ? 0 : 45,
          focus_muscle_groups: i === 6 ? [] : ['chest', 'shoulders'],
          adherence_status: 'not_started' as const,
          completed_at: null,
          created_at: '2025-01-27T10:00:00Z',
          exercises: [],
        })),
        plan_metadata: {
          total_weekly_duration_minutes: 270, // 6 × 45
        },
      };

      vi.mocked(getWeeklyPlan).mockResolvedValue(mockPlan as any);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Requirement 5.5: Exactly 7 days ordered by day_index
      expect(data.plan_days).toHaveLength(7);
      data.plan_days.forEach((day: any, index: number) => {
        expect(day.day_index).toBe(index);
      });

      // Requirement 5.10: adherence_status included for each day
      data.plan_days.forEach((day: any) => {
        expect(day.adherence_status).toBeDefined();
        expect(day.adherence_status).toBe('not_started');
      });

      // Requirement 5.9: total_weekly_duration_minutes calculated
      expect(data.plan_metadata.total_weekly_duration_minutes).toBe(270);
    });

    it('should return exercises ordered by order_index', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockPlan = {
        id: 'plan-123',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
        plan_days: [{
          id: 'day-0',
          weekly_plan_id: 'plan-123',
          day_index: 0,
          workout_type: 'Push',
          estimated_duration_minutes: 45,
          focus_muscle_groups: ['chest'],
          adherence_status: 'not_started' as const,
          completed_at: null,
          created_at: '2025-01-27T10:00:00Z',
          exercises: [
            {
              id: 'ex-1',
              plan_day_id: 'day-0',
              exercise_id: 'exercise-1',
              target_sets: 3,
              target_reps: 10,
              suggested_weight_kg: 50,
              rest_seconds: 60,
              order_index: 0,
              rationale: 'Warm up',
              exercise_name: 'Bench Press',
              muscle_group: 'Chest',
              equipment: 'Barbell',
            },
            {
              id: 'ex-2',
              plan_day_id: 'day-0',
              exercise_id: 'exercise-2',
              target_sets: 3,
              target_reps: 12,
              suggested_weight_kg: 30,
              rest_seconds: 60,
              order_index: 1,
              rationale: 'Volume work',
              exercise_name: 'Incline Dumbbell Press',
              muscle_group: 'Chest',
              equipment: 'Dumbbell',
            },
            {
              id: 'ex-3',
              plan_day_id: 'day-0',
              exercise_id: 'exercise-3',
              target_sets: 3,
              target_reps: 15,
              suggested_weight_kg: 20,
              rest_seconds: 45,
              order_index: 2,
              rationale: 'Finishing',
              exercise_name: 'Cable Flyes',
              muscle_group: 'Chest',
              equipment: 'Cable',
            },
          ],
        }],
        plan_metadata: {
          total_weekly_duration_minutes: 45,
        },
      };

      vi.mocked(getWeeklyPlan).mockResolvedValue(mockPlan as any);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Requirement 5.6: Exercises ordered by order_index
      const exercises = data.plan_days[0].exercises;
      expect(exercises).toHaveLength(3);
      expect(exercises[0].order_index).toBe(0);
      expect(exercises[1].order_index).toBe(1);
      expect(exercises[2].order_index).toBe(2);

      // Requirement 5.7: Exercise details included (name, muscle_group, equipment)
      exercises.forEach((exercise: any) => {
        expect(exercise.exercise_name).toBeDefined();
        expect(exercise.muscle_group).toBeDefined();
        expect(exercise.equipment).toBeDefined();
      });

      expect(exercises[0].exercise_name).toBe('Bench Press');
      expect(exercises[0].muscle_group).toBe('Chest');
      expect(exercises[0].equipment).toBe('Barbell');
    });

    it('should include all exercise details from exercises table', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockPlan = {
        id: 'plan-123',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
        plan_days: [{
          id: 'day-0',
          weekly_plan_id: 'plan-123',
          day_index: 0,
          workout_type: 'Push',
          estimated_duration_minutes: 45,
          focus_muscle_groups: ['chest'],
          adherence_status: 'completed' as const,
          completed_at: '2025-01-27T18:00:00Z',
          created_at: '2025-01-27T10:00:00Z',
          exercises: [{
            id: 'ex-1',
            plan_day_id: 'day-0',
            exercise_id: 'exercise-1',
            target_sets: 3,
            target_reps: 10,
            suggested_weight_kg: 50,
            rest_seconds: 60,
            order_index: 0,
            rationale: 'Test',
            exercise_name: 'Squat',
            muscle_group: 'Legs',
            equipment: 'Barbell',
          }],
        }],
        plan_metadata: {
          total_weekly_duration_minutes: 45,
        },
      };

      vi.mocked(getWeeklyPlan).mockResolvedValue(mockPlan as any);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      const exercise = data.plan_days[0].exercises[0];
      
      // Requirement 5.7: All exercise details from joined exercises table
      expect(exercise.exercise_name).toBe('Squat');
      expect(exercise.muscle_group).toBe('Legs');
      expect(exercise.equipment).toBe('Barbell');
      expect(exercise.target_sets).toBe(3);
      expect(exercise.target_reps).toBe(10);
      expect(exercise.suggested_weight_kg).toBe(50);
      expect(exercise.rest_seconds).toBe(60);

      // Requirement 5.10: adherence_status included
      expect(data.plan_days[0].adherence_status).toBe('completed');
      expect(data.plan_days[0].completed_at).toBe('2025-01-27T18:00:00Z');
    });
  });

  describe('Database Error Handling', () => {
    it('should return 500 DATABASE_ERROR for database failures', async () => {
      const { getWeeklyPlan, DatabaseError } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getWeeklyPlan).mockRejectedValue(
        new DatabaseError('Connection failed', 'getWeeklyPlan')
      );
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('DATABASE_ERROR');
      expect(data.error).toContain('retrieve');
    });

    it('should return 500 INTERNAL_ERROR for unexpected errors', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getWeeklyPlan).mockRejectedValue(new Error('Unexpected error'));
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Response Structure - Requirement 5.8', () => {
    it('should return complete nested JSON structure', async () => {
      const { getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockPlan = {
        id: 'plan-123',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
        plan_days: Array.from({ length: 7 }, (_, i) => ({
          id: `day-${i}`,
          weekly_plan_id: 'plan-123',
          day_index: i,
          workout_type: 'Push',
          estimated_duration_minutes: 45,
          focus_muscle_groups: ['chest'],
          adherence_status: 'not_started' as const,
          completed_at: null,
          created_at: '2025-01-27T10:00:00Z',
          exercises: [{
            id: `ex-${i}`,
            plan_day_id: `day-${i}`,
            exercise_id: `exercise-${i}`,
            target_sets: 3,
            target_reps: 10,
            suggested_weight_kg: 50,
            rest_seconds: 60,
            order_index: 0,
            rationale: 'Test',
            exercise_name: 'Bench Press',
            muscle_group: 'Chest',
            equipment: 'Barbell',
          }],
        })),
        plan_metadata: {
          total_weekly_duration_minutes: 315,
        },
      };

      vi.mocked(getWeeklyPlan).mockResolvedValue(mockPlan as any);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify top-level plan structure
      expect(data.id).toBe('plan-123');
      expect(data.user_id).toBe('test-user');
      expect(data.week_start_date).toBe('2025-01-27');
      expect(data.created_at).toBeDefined();
      expect(data.updated_at).toBeDefined();

      // Verify nested plan_days
      expect(data.plan_days).toBeInstanceOf(Array);
      expect(data.plan_days).toHaveLength(7);

      // Verify nested exercises within each day
      data.plan_days.forEach((day: any) => {
        expect(day.exercises).toBeInstanceOf(Array);
        expect(day.exercises.length).toBeGreaterThan(0);
        
        day.exercises.forEach((exercise: any) => {
          expect(exercise.id).toBeDefined();
          expect(exercise.exercise_name).toBeDefined();
          expect(exercise.muscle_group).toBeDefined();
          expect(exercise.equipment).toBeDefined();
        });
      });

      // Verify plan_metadata
      expect(data.plan_metadata).toBeDefined();
      expect(data.plan_metadata.total_weekly_duration_minutes).toBe(315);
    });
  });
});
