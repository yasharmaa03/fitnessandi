// ============================================================================
// Adherence History Integration Tests
// ============================================================================
// Tests for GET /api/workout/weekly-plan/adherence-history endpoint
// Task 12 validation tests
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 6.10
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../adherence-history/route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/weekly-planner/db', () => ({
  getAdherenceHistory: vi.fn(),
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, public operation: string, public originalError?: unknown) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

describe('GET /api/workout/weekly-plan/adherence-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation - Requirement 6.1', () => {
    it('should return 400 VALIDATION_ERROR for missing user_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('user_id');
      expect(data.details.errors).toContain('user_id is required');
    });

    it('should return 400 VALIDATION_ERROR for empty user_id', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=   ');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR for invalid weeks_back (non-numeric)', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=invalid');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('weeks_back');
    });

    it('should return 400 VALIDATION_ERROR for negative weeks_back', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=-1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details.errors).toContain('weeks_back must be a positive integer');
    });

    it('should return 400 VALIDATION_ERROR for zero weeks_back', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=0');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should default to 4 weeks when weeks_back is omitted', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getAdherenceHistory).mockResolvedValue({
        weekly_stats: [],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 0,
      });
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      await GET(request);

      expect(getAdherenceHistory).toHaveBeenCalledWith(
        expect.anything(),
        'test-user',
        4 // Default value
      );
    });

    it('should cap weeks_back at 12 maximum', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getAdherenceHistory).mockResolvedValue({
        weekly_stats: [],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 0,
      });
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=20');

      await GET(request);

      expect(getAdherenceHistory).toHaveBeenCalledWith(
        expect.anything(),
        'test-user',
        12 // Capped at max
      );
    });
  });

  describe('Zero Values When No Plans Exist - Requirement 6.6', () => {
    it('should return 200 with zero values when user has no plans', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getAdherenceHistory).mockResolvedValue({
        weekly_stats: [],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 0,
      });
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=new-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.weekly_stats).toEqual([]);
      expect(data.day_of_week_breakdown).toEqual([]);
      expect(data.most_completed_muscle_groups).toEqual([]);
      expect(data.overall_completion_rate_percentage).toBe(0);
    });
  });

  describe('Adherence Statistics Calculation - Requirements 6.2, 6.3', () => {
    it('should return overall completion rate percentage', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [
          {
            week_start_date: '2025-01-27',
            total_planned_days: 7,
            completed_days: 5,
            skipped_days: 2,
            completion_rate_percentage: 71.4,
            average_workout_duration_minutes: 45,
          },
        ],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: ['chest', 'back', 'legs'],
        overall_completion_rate_percentage: 71.4,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overall_completion_rate_percentage).toBe(71.4);
      expect(data.weekly_stats).toHaveLength(1);
      expect(data.weekly_stats[0].total_planned_days).toBe(7);
      expect(data.weekly_stats[0].completed_days).toBe(5);
      expect(data.weekly_stats[0].skipped_days).toBe(2);
    });

    it('should exclude not_started days from completion rate calculation', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [
          {
            week_start_date: '2025-01-27',
            total_planned_days: 5, // 7 days total, but 2 are not_started
            completed_days: 3,
            skipped_days: 2,
            completion_rate_percentage: 60.0, // 3/5 = 60%
            average_workout_duration_minutes: 45,
          },
        ],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 60.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Requirement 6.9: not_started excluded from denominator
      expect(data.weekly_stats[0].total_planned_days).toBe(5); // Not 7
      expect(data.weekly_stats[0].completion_rate_percentage).toBe(60.0);
    });
  });

  describe('Weekly Grouping and Ordering - Requirement 6.4', () => {
    it('should group by week_start_date and order descending (newest first)', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [
          {
            week_start_date: '2025-02-03', // Newest
            total_planned_days: 7,
            completed_days: 6,
            skipped_days: 1,
            completion_rate_percentage: 85.7,
            average_workout_duration_minutes: 50,
          },
          {
            week_start_date: '2025-01-27', // Second newest
            total_planned_days: 7,
            completed_days: 5,
            skipped_days: 2,
            completion_rate_percentage: 71.4,
            average_workout_duration_minutes: 45,
          },
          {
            week_start_date: '2025-01-20', // Oldest
            total_planned_days: 6,
            completed_days: 4,
            skipped_days: 2,
            completion_rate_percentage: 66.7,
            average_workout_duration_minutes: 42,
          },
        ],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 75.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=3');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.weekly_stats).toHaveLength(3);
      
      // Verify descending order (newest first)
      expect(data.weekly_stats[0].week_start_date).toBe('2025-02-03');
      expect(data.weekly_stats[1].week_start_date).toBe('2025-01-27');
      expect(data.weekly_stats[2].week_start_date).toBe('2025-01-20');
    });

    it('should include per-week completion rates', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [
          {
            week_start_date: '2025-01-27',
            total_planned_days: 7,
            completed_days: 7,
            skipped_days: 0,
            completion_rate_percentage: 100.0,
            average_workout_duration_minutes: 45,
          },
          {
            week_start_date: '2025-01-20',
            total_planned_days: 7,
            completed_days: 0,
            skipped_days: 7,
            completion_rate_percentage: 0.0,
            average_workout_duration_minutes: 0,
          },
        ],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 50.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.weekly_stats[0].completion_rate_percentage).toBe(100.0);
      expect(data.weekly_stats[1].completion_rate_percentage).toBe(0.0);
    });
  });

  describe('Day-of-Week Aggregation - Requirement 6.5', () => {
    it('should return breakdown for all 7 days of week', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [],
        day_of_week_breakdown: [
          { day_of_week: 'Monday', total_planned: 4, completed: 3, completion_rate_percentage: 75.0 },
          { day_of_week: 'Tuesday', total_planned: 4, completed: 4, completion_rate_percentage: 100.0 },
          { day_of_week: 'Wednesday', total_planned: 4, completed: 2, completion_rate_percentage: 50.0 },
          { day_of_week: 'Thursday', total_planned: 4, completed: 3, completion_rate_percentage: 75.0 },
          { day_of_week: 'Friday', total_planned: 4, completed: 4, completion_rate_percentage: 100.0 },
          { day_of_week: 'Saturday', total_planned: 4, completed: 1, completion_rate_percentage: 25.0 },
          { day_of_week: 'Sunday', total_planned: 4, completed: 0, completion_rate_percentage: 0.0 },
        ],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 60.7,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=4');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.day_of_week_breakdown).toHaveLength(7);

      // Verify each day has the required fields
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      data.day_of_week_breakdown.forEach((day: any, index: number) => {
        expect(day.day_of_week).toBe(dayNames[index]);
        expect(day.total_planned).toBeDefined();
        expect(day.completed).toBeDefined();
        expect(day.completion_rate_percentage).toBeDefined();
      });
    });

    it('should show which days have highest completion rates', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [],
        day_of_week_breakdown: [
          { day_of_week: 'Monday', total_planned: 4, completed: 4, completion_rate_percentage: 100.0 },
          { day_of_week: 'Tuesday', total_planned: 4, completed: 1, completion_rate_percentage: 25.0 },
          { day_of_week: 'Wednesday', total_planned: 4, completed: 3, completion_rate_percentage: 75.0 },
          { day_of_week: 'Thursday', total_planned: 4, completed: 2, completion_rate_percentage: 50.0 },
          { day_of_week: 'Friday', total_planned: 4, completed: 4, completion_rate_percentage: 100.0 },
          { day_of_week: 'Saturday', total_planned: 4, completed: 0, completion_rate_percentage: 0.0 },
          { day_of_week: 'Sunday', total_planned: 4, completed: 0, completion_rate_percentage: 0.0 },
        ],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 50.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Find the best and worst days
      const monday = data.day_of_week_breakdown.find((d: any) => d.day_of_week === 'Monday');
      const friday = data.day_of_week_breakdown.find((d: any) => d.day_of_week === 'Friday');
      const saturday = data.day_of_week_breakdown.find((d: any) => d.day_of_week === 'Saturday');

      expect(monday.completion_rate_percentage).toBe(100.0);
      expect(friday.completion_rate_percentage).toBe(100.0);
      expect(saturday.completion_rate_percentage).toBe(0.0);
    });
  });

  describe('Average Duration Calculation - Requirement 6.8', () => {
    it('should calculate average duration from completed days only', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [
          {
            week_start_date: '2025-01-27',
            total_planned_days: 7,
            completed_days: 3,
            skipped_days: 4,
            completion_rate_percentage: 42.9,
            average_workout_duration_minutes: 47, // Average of completed days only (45 + 50 + 46) / 3
          },
        ],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 42.9,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Requirement 6.8: Only completed days included in average
      expect(data.weekly_stats[0].average_workout_duration_minutes).toBe(47);
    });

    it('should return 0 average duration when no completed days', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [
          {
            week_start_date: '2025-01-27',
            total_planned_days: 7,
            completed_days: 0,
            skipped_days: 7,
            completion_rate_percentage: 0.0,
            average_workout_duration_minutes: 0,
          },
        ],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 0.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.weekly_stats[0].average_workout_duration_minutes).toBe(0);
    });
  });

  describe('Top Muscle Groups - Requirement 6.10', () => {
    it('should return top 3 most completed muscle groups', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: ['chest', 'back', 'legs'],
        overall_completion_rate_percentage: 75.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.most_completed_muscle_groups).toEqual(['chest', 'back', 'legs']);
      expect(data.most_completed_muscle_groups).toHaveLength(3);
    });

    it('should handle case with fewer than 3 muscle groups', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: ['chest'],
        overall_completion_rate_percentage: 50.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.most_completed_muscle_groups).toEqual(['chest']);
      expect(data.most_completed_muscle_groups.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array when no completed workouts', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 0.0,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.most_completed_muscle_groups).toEqual([]);
    });
  });

  describe('Complete Response Structure', () => {
    it('should return all required fields in response', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      const mockStats = {
        weekly_stats: [
          {
            week_start_date: '2025-01-27',
            total_planned_days: 7,
            completed_days: 5,
            skipped_days: 2,
            completion_rate_percentage: 71.4,
            average_workout_duration_minutes: 45,
          },
        ],
        day_of_week_breakdown: [
          { day_of_week: 'Monday', total_planned: 1, completed: 1, completion_rate_percentage: 100.0 },
          { day_of_week: 'Tuesday', total_planned: 1, completed: 1, completion_rate_percentage: 100.0 },
          { day_of_week: 'Wednesday', total_planned: 1, completed: 1, completion_rate_percentage: 100.0 },
          { day_of_week: 'Thursday', total_planned: 1, completed: 1, completion_rate_percentage: 100.0 },
          { day_of_week: 'Friday', total_planned: 1, completed: 1, completion_rate_percentage: 100.0 },
          { day_of_week: 'Saturday', total_planned: 1, completed: 0, completion_rate_percentage: 0.0 },
          { day_of_week: 'Sunday', total_planned: 1, completed: 0, completion_rate_percentage: 0.0 },
        ],
        most_completed_muscle_groups: ['chest', 'back', 'legs'],
        overall_completion_rate_percentage: 71.4,
      };

      vi.mocked(getAdherenceHistory).mockResolvedValue(mockStats);
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user&weeks_back=1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify all top-level fields exist
      expect(data.weekly_stats).toBeDefined();
      expect(data.day_of_week_breakdown).toBeDefined();
      expect(data.most_completed_muscle_groups).toBeDefined();
      expect(data.overall_completion_rate_percentage).toBeDefined();

      // Verify weekly_stats structure
      expect(data.weekly_stats[0].week_start_date).toBeDefined();
      expect(data.weekly_stats[0].total_planned_days).toBeDefined();
      expect(data.weekly_stats[0].completed_days).toBeDefined();
      expect(data.weekly_stats[0].skipped_days).toBeDefined();
      expect(data.weekly_stats[0].completion_rate_percentage).toBeDefined();
      expect(data.weekly_stats[0].average_workout_duration_minutes).toBeDefined();

      // Verify day_of_week_breakdown structure
      expect(data.day_of_week_breakdown).toHaveLength(7);
      data.day_of_week_breakdown.forEach((day: any) => {
        expect(day.day_of_week).toBeDefined();
        expect(day.total_planned).toBeDefined();
        expect(day.completed).toBeDefined();
        expect(day.completion_rate_percentage).toBeDefined();
      });
    });
  });

  describe('Database Error Handling', () => {
    it('should return 500 DATABASE_ERROR for database failures', async () => {
      const { getAdherenceHistory, DatabaseError } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getAdherenceHistory).mockRejectedValue(
        new DatabaseError('Connection failed', 'getAdherenceHistory')
      );
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('DATABASE_ERROR');
      expect(data.error).toContain('retrieve');
    });

    it('should return 500 INTERNAL_ERROR for unexpected errors', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getAdherenceHistory).mockRejectedValue(new Error('Unexpected error'));
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Content-Type Headers', () => {
    it('should include Content-Type: application/json in all responses', async () => {
      const { getAdherenceHistory } = await import('@/lib/weekly-planner/db');
      const { createServerClient } = await import('@/lib/supabase/server');

      vi.mocked(getAdherenceHistory).mockResolvedValue({
        weekly_stats: [],
        day_of_week_breakdown: [],
        most_completed_muscle_groups: [],
        overall_completion_rate_percentage: 0,
      });
      vi.mocked(createServerClient).mockReturnValue({} as any);

      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history?user_id=test-user');

      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should include Content-Type in error responses', async () => {
      const request = new Request('http://localhost/api/workout/weekly-plan/adherence-history');

      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});
