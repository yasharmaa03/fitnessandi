// ============================================================================
// Weekly Plan Adherence API Tests
// ============================================================================
// Tests for PATCH /api/workout/weekly-plan/adherence endpoint
// Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '../route';
import * as supabaseServer from '@/lib/supabase/server';
import { DatabaseError } from '@/lib/weekly-planner/db';
import * as db from '@/lib/weekly-planner/db';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/weekly-planner/db', () => ({
  updateAdherence: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    constructor(
      message: string,
      public operation: string,
      public originalError?: unknown
    ) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

describe('PATCH /api/workout/weekly-plan/adherence', () => {
  const mockSupabaseClient = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabaseServer.createServerClient).mockReturnValue(mockSupabaseClient);
  });

  describe('Request Validation', () => {
    it('should return 400 INVALID_JSON for malformed JSON', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        body: 'invalid json',
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_JSON');
      expect(data.error).toContain('Invalid JSON');
    });

    it('should return 400 VALIDATION_ERROR for missing plan_day_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adherence_status: 'completed',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toContain('plan_day_id is required and must be a string');
    });

    it('should return 400 VALIDATION_ERROR for empty plan_day_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: '   ',
          adherence_status: 'completed',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toContain('plan_day_id must not be empty');
    });

    it('should return 400 VALIDATION_ERROR for missing adherence_status', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'abc-123',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toContain('adherence_status is required and must be a string');
    });

    it('should return 400 VALIDATION_ERROR for invalid adherence_status enum value', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'abc-123',
          adherence_status: 'invalid_status',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors[0]).toContain('adherence_status must be one of');
    });
  });

  describe('Successful Updates', () => {
    it('should update adherence status to completed and set completed_at', async () => {
      const mockUpdatedDay = {
        id: 'day-123',
        weekly_plan_id: 'plan-456',
        day_index: 0,
        workout_type: 'Push',
        estimated_duration_minutes: 45,
        focus_muscle_groups: ['chest', 'shoulders'],
        adherence_status: 'completed',
        completed_at: '2025-01-29T10:00:00.000Z',
        created_at: '2025-01-27T08:00:00.000Z',
      };

      vi.mocked(db.updateAdherence).mockResolvedValue(mockUpdatedDay);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'day-123',
          adherence_status: 'completed',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('day-123');
      expect(data.adherence_status).toBe('completed');
      expect(data.completed_at).toBe('2025-01-29T10:00:00.000Z');
      expect(vi.mocked(db.updateAdherence)).toHaveBeenCalledWith(
        mockSupabaseClient,
        'day-123',
        'completed'
      );
    });

    it('should update adherence status to in_progress without setting completed_at', async () => {
      const mockUpdatedDay = {
        id: 'day-123',
        weekly_plan_id: 'plan-456',
        day_index: 1,
        workout_type: 'Pull',
        estimated_duration_minutes: 50,
        focus_muscle_groups: ['back', 'biceps'],
        adherence_status: 'in_progress',
        completed_at: null,
        created_at: '2025-01-27T08:00:00.000Z',
      };

      vi.mocked(db.updateAdherence).mockResolvedValue(mockUpdatedDay);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'day-123',
          adherence_status: 'in_progress',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.adherence_status).toBe('in_progress');
      expect(data.completed_at).toBeNull();
    });

    it('should update adherence status to skipped', async () => {
      const mockUpdatedDay = {
        id: 'day-123',
        weekly_plan_id: 'plan-456',
        day_index: 2,
        workout_type: 'Legs',
        estimated_duration_minutes: 60,
        focus_muscle_groups: ['quads', 'hamstrings'],
        adherence_status: 'skipped',
        completed_at: null,
        created_at: '2025-01-27T08:00:00.000Z',
      };

      vi.mocked(db.updateAdherence).mockResolvedValue(mockUpdatedDay);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'day-123',
          adherence_status: 'skipped',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.adherence_status).toBe('skipped');
    });

    it('should accept all valid adherence status values', async () => {
      const validStatuses = ['not_started', 'in_progress', 'completed', 'skipped'];

      for (const status of validStatuses) {
        const mockUpdatedDay = {
          id: 'day-123',
          weekly_plan_id: 'plan-456',
          day_index: 0,
          workout_type: 'Push',
          estimated_duration_minutes: 45,
          focus_muscle_groups: ['chest'],
          adherence_status: status as any,
          completed_at: status === 'completed' ? '2025-01-29T10:00:00.000Z' : null,
          created_at: '2025-01-27T08:00:00.000Z',
        };

        vi.mocked(db.updateAdherence).mockResolvedValue(mockUpdatedDay);

        const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_day_id: 'day-123',
            adherence_status: status,
          }),
        });

        const response = await PATCH(request);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 PLAN_DAY_NOT_FOUND when plan_day_id does not exist', async () => {
      const dbError = new db.DatabaseError(
        'Adherence update succeeded but no data returned',
        'updateAdherence'
      );

      vi.mocked(db.updateAdherence).mockRejectedValue(dbError);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'nonexistent-id',
          adherence_status: 'completed',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      // The error message contains "succeeded but no data" which indicates not found
      expect(response.status).toBe(404);
      expect(data.code).toBe('PLAN_DAY_NOT_FOUND');
      expect(data.error).toContain('Plan day not found');
    });

    it('should return 500 DATABASE_ERROR for database failures', async () => {
      const dbError = new db.DatabaseError(
        'Connection failed',
        'updateAdherence',
        new Error('Network error')
      );

      vi.mocked(db.updateAdherence).mockRejectedValue(dbError);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'day-123',
          adherence_status: 'completed',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('DATABASE_ERROR');
      expect(data.error).toContain('Failed to update adherence status');
    });

    it('should return 500 INTERNAL_ERROR for unexpected errors', async () => {
      vi.mocked(db.updateAdherence).mockRejectedValue(new Error('Unexpected error'));

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'day-123',
          adherence_status: 'completed',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Content-Type Headers', () => {
    it('should return Content-Type: application/json for success responses', async () => {
      const mockUpdatedDay = {
        id: 'day-123',
        weekly_plan_id: 'plan-456',
        day_index: 0,
        workout_type: 'Push',
        estimated_duration_minutes: 45,
        focus_muscle_groups: ['chest'],
        adherence_status: 'completed',
        completed_at: '2025-01-29T10:00:00.000Z',
        created_at: '2025-01-27T08:00:00.000Z',
      };

      vi.mocked(db.updateAdherence).mockResolvedValue(mockUpdatedDay);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_day_id: 'day-123',
          adherence_status: 'completed',
        }),
      });

      const response = await PATCH(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return Content-Type: application/json for error responses', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence', {
        method: 'PATCH',
        body: 'invalid json',
      });

      const response = await PATCH(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});
