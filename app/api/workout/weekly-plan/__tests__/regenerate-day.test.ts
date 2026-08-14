// ============================================================================
// Weekly Plan - Regenerate Day Integration Tests
// ============================================================================
// Tests for POST /api/workout/weekly-plan/regenerate-day endpoint
// Task 9 validation tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../regenerate-day/route';
import type { RegenerateDayRequest } from '@/lib/types/weekly-planner';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/weekly-planner/ml-client', () => ({
  fetchRecommendation: vi.fn(),
  MLEngineError: class MLEngineError extends Error {
    constructor(message: string, public statusCode?: number) {
      super(message);
      this.name = 'MLEngineError';
    }
  },
  InvalidMLResponseError: class InvalidMLResponseError extends Error {
    constructor(message: string, public missingFields?: string[]) {
      super(message);
      this.name = 'InvalidMLResponseError';
    }
  },
}));

vi.mock('@/lib/weekly-planner/db', () => ({
  regenerateDay: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, public operation: string, public originalError?: unknown) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

describe('POST /api/workout/weekly-plan/regenerate-day', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should return 400 INVALID_JSON for malformed JSON', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_JSON');
      expect(data.error).toContain('Invalid JSON');
    });

    it('should return 400 VALIDATION_ERROR for missing weekly_plan_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_index: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toBeDefined();
    });

    it('should return 400 VALIDATION_ERROR for missing day_index', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR for day_index < 0', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: -1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toBeDefined();
      expect(data.details.errors.some((e: string) => e.includes('day_index must be between 0 and 6'))).toBe(true);
    });

    it('should return 400 VALIDATION_ERROR for day_index > 6', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: 7,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toBeDefined();
      expect(data.details.errors.some((e: string) => e.includes('day_index must be between 0 and 6'))).toBe(true);
    });
  });

  describe('Plan Existence Validation', () => {
    it('should return 404 PLAN_NOT_FOUND when weekly_plan_id does not exist', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        }),
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'nonexistent-plan',
          day_index: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PLAN_NOT_FOUND');
      expect(data.details.weekly_plan_id).toBe('nonexistent-plan');
    });
  });

  describe('Date Calculation', () => {
    it('should calculate correct target date from week_start_date and day_index', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const { fetchRecommendation } = await import('@/lib/weekly-planner/ml-client');
      const { regenerateDay } = await import('@/lib/weekly-planner/db');

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'plan-123',
            week_start_date: '2025-01-27', // Monday
            user_id: 'test-user',
          },
          error: null,
        }),
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const mockMLResponse = {
        date: '2025-01-29',
        workout_type: 'Pull',
        recommended_exercises: [{
          exercise_id: 'ex-1',
          exercise_name: 'Pull Up',
          muscle_group: 'back',
          target_sets: 3,
          target_reps: 10,
          suggested_weight_kg: 0,
          rest_seconds: 90,
          rationale: 'Great for back',
        }],
        plan_metadata: {
          total_exercises: 1,
          estimated_duration_minutes: 45,
          focus_areas: ['back'],
        },
      };

      vi.mocked(fetchRecommendation).mockResolvedValue(mockMLResponse as any);

      const mockUpdatedDay = {
        id: 'day-2',
        weekly_plan_id: 'plan-123',
        day_index: 2,
        workout_type: 'Pull',
        estimated_duration_minutes: 45,
        focus_muscle_groups: ['back'],
        adherence_status: 'not_started' as const,
        completed_at: null,
        created_at: '2025-01-27T10:00:00Z',
        exercises: [{
          id: 'pe-1',
          plan_day_id: 'day-2',
          exercise_id: 'ex-1',
          target_sets: 3,
          target_reps: 10,
          suggested_weight_kg: 0,
          rest_seconds: 90,
          order_index: 0,
          rationale: 'Great for back',
          exercise_name: 'Pull Up',
          muscle_group: 'back',
          equipment: 'bodyweight',
        }],
      };

      vi.mocked(regenerateDay).mockResolvedValue(mockUpdatedDay as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: 2, // Wednesday
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      
      // Verify fetchRecommendation was called with correct date
      // Monday (2025-01-27) + 2 days = Wednesday (2025-01-29)
      expect(fetchRecommendation).toHaveBeenCalledWith('test-user', '2025-01-29');
    });
  });

  describe('ML Engine Error Handling', () => {
    it('should return 503 SERVICE_UNAVAILABLE when ML Engine is unreachable', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const { fetchRecommendation, MLEngineError } = await import('@/lib/weekly-planner/ml-client');

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'plan-123',
            week_start_date: '2025-01-27',
            user_id: 'test-user',
          },
          error: null,
        }),
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);
      vi.mocked(fetchRecommendation).mockRejectedValue(
        new MLEngineError('Connection refused')
      );

      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should return 500 ML_ENGINE_ERROR when ML Engine returns error', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const { fetchRecommendation, MLEngineError } = await import('@/lib/weekly-planner/ml-client');

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'plan-123',
            week_start_date: '2025-01-27',
            user_id: 'test-user',
          },
          error: null,
        }),
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);
      vi.mocked(fetchRecommendation).mockRejectedValue(
        new MLEngineError('Recommendation failed', 500)
      );

      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('ML_ENGINE_ERROR');
    });

    it('should return 502 INVALID_ML_RESPONSE when ML response is malformed', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const { fetchRecommendation, InvalidMLResponseError } = await import('@/lib/weekly-planner/ml-client');

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'plan-123',
            week_start_date: '2025-01-27',
            user_id: 'test-user',
          },
          error: null,
        }),
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);
      vi.mocked(fetchRecommendation).mockRejectedValue(
        new InvalidMLResponseError('Missing fields', ['recommended_exercises'])
      );

      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.code).toBe('INVALID_ML_RESPONSE');
      expect(data.details.missingFields).toContain('recommended_exercises');
    });
  });

  describe('Database Error Handling', () => {
    it('should return 500 DATABASE_ERROR for database failures', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const { fetchRecommendation } = await import('@/lib/weekly-planner/ml-client');
      const { regenerateDay, DatabaseError } = await import('@/lib/weekly-planner/db');

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'plan-123',
            week_start_date: '2025-01-27',
            user_id: 'test-user',
          },
          error: null,
        }),
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const mockMLResponse = {
        date: '2025-01-29',
        workout_type: 'Pull',
        recommended_exercises: [],
        plan_metadata: {
          total_exercises: 0,
          estimated_duration_minutes: 45,
          focus_areas: ['back'],
        },
      };

      vi.mocked(fetchRecommendation).mockResolvedValue(mockMLResponse as any);
      vi.mocked(regenerateDay).mockRejectedValue(
        new DatabaseError('Connection failed', 'regenerateDay')
      );

      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('DATABASE_ERROR');
    });
  });

  describe('Successful Day Regeneration', () => {
    it('should return 200 with updated plan day', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const { fetchRecommendation } = await import('@/lib/weekly-planner/ml-client');
      const { regenerateDay } = await import('@/lib/weekly-planner/db');

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'plan-123',
            week_start_date: '2025-01-27',
            user_id: 'test-user',
          },
          error: null,
        }),
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const mockMLResponse = {
        date: '2025-01-29',
        workout_type: 'Legs',
        recommended_exercises: [
          {
            exercise_id: 'ex-1',
            exercise_name: 'Squat',
            muscle_group: 'quadriceps',
            target_sets: 4,
            target_reps: 8,
            suggested_weight_kg: 100,
            rest_seconds: 120,
            rationale: 'Great for legs',
          },
          {
            exercise_id: 'ex-2',
            exercise_name: 'Deadlift',
            muscle_group: 'hamstrings',
            target_sets: 3,
            target_reps: 6,
            suggested_weight_kg: 120,
            rest_seconds: 180,
            rationale: 'Posterior chain',
          },
        ],
        plan_metadata: {
          total_exercises: 2,
          estimated_duration_minutes: 60,
          focus_areas: ['quadriceps', 'hamstrings'],
        },
      };

      vi.mocked(fetchRecommendation).mockResolvedValue(mockMLResponse as any);

      const mockUpdatedDay = {
        id: 'day-2-new',
        weekly_plan_id: 'plan-123',
        day_index: 2,
        workout_type: 'Legs',
        estimated_duration_minutes: 60,
        focus_muscle_groups: ['quadriceps', 'hamstrings'],
        adherence_status: 'not_started' as const,
        completed_at: null,
        created_at: new Date().toISOString(),
        exercises: [
          {
            id: 'pe-1',
            plan_day_id: 'day-2-new',
            exercise_id: 'ex-1',
            target_sets: 4,
            target_reps: 8,
            suggested_weight_kg: 100,
            rest_seconds: 120,
            order_index: 0,
            rationale: 'Great for legs',
            exercise_name: 'Squat',
            muscle_group: 'quadriceps',
            equipment: 'barbell',
          },
          {
            id: 'pe-2',
            plan_day_id: 'day-2-new',
            exercise_id: 'ex-2',
            target_sets: 3,
            target_reps: 6,
            suggested_weight_kg: 120,
            rest_seconds: 180,
            order_index: 1,
            rationale: 'Posterior chain',
            exercise_name: 'Deadlift',
            muscle_group: 'hamstrings',
            equipment: 'barbell',
          },
        ],
      };

      vi.mocked(regenerateDay).mockResolvedValue(mockUpdatedDay as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/regenerate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekly_plan_id: 'plan-123',
          day_index: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('day-2-new');
      expect(data.weekly_plan_id).toBe('plan-123');
      expect(data.day_index).toBe(2);
      expect(data.workout_type).toBe('Legs');
      expect(data.estimated_duration_minutes).toBe(60);
      expect(data.adherence_status).toBe('not_started');
      expect(data.exercises).toHaveLength(2);
      
      // Verify exercises have correct structure
      expect(data.exercises[0].exercise_name).toBe('Squat');
      expect(data.exercises[0].order_index).toBe(0);
      expect(data.exercises[1].exercise_name).toBe('Deadlift');
      expect(data.exercises[1].order_index).toBe(1);
      
      // Verify regenerateDay was called with correct parameters
      expect(regenerateDay).toHaveBeenCalledWith(
        mockSupabase,
        'plan-123',
        2,
        mockMLResponse
      );
    });
  });
});
