// ============================================================================
// Weekly Plan Creation Integration Tests
// ============================================================================
// Tests for POST /api/workout/weekly-plan endpoint
// Task 8 validation tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import type { CreateWeeklyPlanRequest } from '@/lib/types/weekly-planner';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/weekly-planner/ml-client', () => ({
  fetchWeeklyRecommendations: vi.fn(),
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
  createWeeklyPlan: vi.fn(),
  getWeeklyPlan: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, public operation: string, public originalError?: unknown) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

describe('POST /api/workout/weekly-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should return 400 INVALID_JSON for malformed JSON', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_JSON');
      expect(data.error).toContain('Invalid JSON');
    });

    it('should return 400 VALIDATION_ERROR for missing user_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toBeDefined();
    });

    it('should return 400 VALIDATION_ERROR for invalid date format', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '01/27/2025', // Wrong format
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR for empty user_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: '   ',
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Monday Normalization', () => {
    it('should normalize non-Monday dates to preceding Monday', async () => {
      const { fetchWeeklyRecommendations } = await import('@/lib/weekly-planner/ml-client');
      const { createWeeklyPlan, getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(fetchWeeklyRecommendations).mockResolvedValue([
        {
          date: '2025-01-27',
          workout_type: 'Push',
          recommended_exercises: [],
          plan_metadata: {
            total_exercises: 0,
            estimated_duration_minutes: 45,
            focus_areas: ['chest'],
          },
        },
        // ... 6 more days would be here
      ] as any);

      vi.mocked(createWeeklyPlan).mockResolvedValue({
        id: 'plan-1',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
      });

      vi.mocked(getWeeklyPlan).mockResolvedValue({
        id: 'plan-1',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
        plan_days: [],
        plan_metadata: { total_weekly_duration_minutes: 0 },
      });

      vi.mocked(createServerClient).mockReturnValue({} as any);

      // Wednesday 2025-01-29 should normalize to Monday 2025-01-27
      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '2025-01-29', // Wednesday
        }),
      });

      const response = await POST(request);
      
      expect(response.status).toBe(201);
      
      // Verify fetchWeeklyRecommendations was called with normalized Monday date
      expect(fetchWeeklyRecommendations).toHaveBeenCalledWith('test-user', '2025-01-27');
    });
  });

  describe('ML Engine Error Handling', () => {
    it('should return 503 SERVICE_UNAVAILABLE when ML Engine is unreachable', async () => {
      const { fetchWeeklyRecommendations, MLEngineError } = await import('@/lib/weekly-planner/ml-client');
      
      vi.mocked(fetchWeeklyRecommendations).mockRejectedValue(
        new MLEngineError('Connection refused')
      );

      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should return 500 ML_ENGINE_ERROR when ML Engine returns error', async () => {
      const { fetchWeeklyRecommendations, MLEngineError } = await import('@/lib/weekly-planner/ml-client');
      
      vi.mocked(fetchWeeklyRecommendations).mockRejectedValue(
        new MLEngineError('Recommendation failed', 500)
      );

      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('ML_ENGINE_ERROR');
    });

    it('should return 502 INVALID_ML_RESPONSE when ML response is malformed', async () => {
      const { fetchWeeklyRecommendations, InvalidMLResponseError } = await import('@/lib/weekly-planner/ml-client');
      
      vi.mocked(fetchWeeklyRecommendations).mockRejectedValue(
        new InvalidMLResponseError('Missing fields', ['recommended_exercises'])
      );

      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.code).toBe('INVALID_ML_RESPONSE');
      expect(data.details.missingFields).toContain('recommended_exercises');
    });
  });

  describe('Duplicate Plan Handling', () => {
    it('should return 409 PLAN_ALREADY_EXISTS for duplicate plan', async () => {
      const { fetchWeeklyRecommendations } = await import('@/lib/weekly-planner/ml-client');
      const { createWeeklyPlan, DatabaseError } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(fetchWeeklyRecommendations).mockResolvedValue([
        {
          date: '2025-01-27',
          workout_type: 'Push',
          recommended_exercises: [],
          plan_metadata: {
            total_exercises: 0,
            estimated_duration_minutes: 45,
            focus_areas: ['chest'],
          },
        },
      ] as any);

      // Simulate unique constraint violation
      const uniqueError = new Error('duplicate key value violates unique constraint "unique_user_week"');
      (uniqueError as any).code = '23505';
      
      vi.mocked(createWeeklyPlan).mockRejectedValue(
        new DatabaseError('Duplicate plan', 'createWeeklyPlan', uniqueError)
      );

      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('PLAN_ALREADY_EXISTS');
      expect(data.details.user_id).toBe('test-user');
      expect(data.details.week_start_date).toBe('2025-01-27');
    });
  });

  describe('Database Error Handling', () => {
    it('should return 500 DATABASE_ERROR for database failures', async () => {
      const { fetchWeeklyRecommendations } = await import('@/lib/weekly-planner/ml-client');
      const { createWeeklyPlan, DatabaseError } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(fetchWeeklyRecommendations).mockResolvedValue([
        {
          date: '2025-01-27',
          workout_type: 'Push',
          recommended_exercises: [],
          plan_metadata: {
            total_exercises: 0,
            estimated_duration_minutes: 45,
            focus_areas: ['chest'],
          },
        },
      ] as any);

      vi.mocked(createWeeklyPlan).mockRejectedValue(
        new DatabaseError('Connection failed', 'createWeeklyPlan')
      );

      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('DATABASE_ERROR');
    });
  });

  describe('Successful Plan Creation', () => {
    it('should return 201 with complete plan structure', async () => {
      const { fetchWeeklyRecommendations } = await import('@/lib/weekly-planner/ml-client');
      const { createWeeklyPlan, getWeeklyPlan } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockMLResponses = Array.from({ length: 7 }, (_, i) => ({
        date: `2025-01-${27 + i}`,
        workout_type: i === 6 ? 'rest' : 'Push',
        recommended_exercises: i === 6 ? [] : [{
          exercise_id: `ex-${i}`,
          exercise_name: `Exercise ${i}`,
          muscle_group: 'chest',
          target_sets: 3,
          target_reps: 10,
          suggested_weight_kg: 50,
          rest_seconds: 60,
          rationale: 'Test exercise',
        }],
        plan_metadata: {
          total_exercises: i === 6 ? 0 : 6,
          estimated_duration_minutes: i === 6 ? 0 : 45,
          focus_areas: i === 6 ? [] : ['chest'],
        },
      }));

      vi.mocked(fetchWeeklyRecommendations).mockResolvedValue(mockMLResponses as any);

      vi.mocked(createWeeklyPlan).mockResolvedValue({
        id: 'plan-123',
        user_id: 'test-user',
        week_start_date: '2025-01-27',
        created_at: '2025-01-27T10:00:00Z',
        updated_at: '2025-01-27T10:00:00Z',
      });

      const mockCompletePlan = {
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
          focus_muscle_groups: i === 6 ? [] : ['chest'],
          adherence_status: 'not_started' as const,
          completed_at: null,
          created_at: '2025-01-27T10:00:00Z',
          exercises: i === 6 ? [] : [{
            id: `pe-${i}`,
            plan_day_id: `day-${i}`,
            exercise_id: `ex-${i}`,
            target_sets: 3,
            target_reps: 10,
            suggested_weight_kg: 50,
            rest_seconds: 60,
            order_index: 0,
            rationale: 'Test exercise',
            exercise_name: `Exercise ${i}`,
            muscle_group: 'chest',
            equipment: 'barbell',
          }],
        })),
        plan_metadata: {
          total_weekly_duration_minutes: 270, // 6 days × 45 min
        },
      };

      vi.mocked(getWeeklyPlan).mockResolvedValue(mockCompletePlan as any);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user',
          week_start_date: '2025-01-27',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('plan-123');
      expect(data.user_id).toBe('test-user');
      expect(data.week_start_date).toBe('2025-01-27');
      expect(data.plan_days).toHaveLength(7);
      expect(data.plan_metadata.total_weekly_duration_minutes).toBe(270);
      
      // Verify all days have correct structure
      data.plan_days.forEach((day: any, index: number) => {
        expect(day.day_index).toBe(index);
        expect(day.adherence_status).toBe('not_started');
        if (index === 6) {
          expect(day.exercises).toHaveLength(0);
        } else {
          expect(day.exercises.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
