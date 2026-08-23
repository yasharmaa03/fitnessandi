import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/workout/set/route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLoggedSet = {
  id: 'set-uuid-1',
  workout_log_id: 'log-uuid-1',
  exercise_id: 'ex-uuid-1',
  set_number: 1,
  weight_kg: 100,
  reps: 8,
  rpe: 7.5,
  logged_at: '2024-01-15T10:05:00Z',
};

let workoutLogExists = true;
let exerciseExists = true;
let insertFails = false;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'workout_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                workoutLogExists
                  ? { data: { id: 'log-uuid-1' }, error: null }
                  : { data: null, error: new Error('not found') }
              ),
            }),
          }),
        };
      }
      if (table === 'exercises') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                exerciseExists
                  ? { data: { id: 'ex-uuid-1' }, error: null }
                  : { data: null, error: new Error('not found') }
              ),
            }),
          }),
        };
      }
      if (table === 'logged_sets') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                insertFails
                  ? { data: null, error: new Error('DB error') }
                  : { data: mockLoggedSet, error: null }
              ),
            }),
          }),
        };
      }
      return {};
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/workout/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  workout_log_id: 'log-uuid-1',
  exercise_id: 'ex-uuid-1',
  set_number: 1,
  weight_kg: 100,
  reps: 8,
  rpe: 7.5,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/workout/set', () => {
  beforeEach(() => {
    workoutLogExists = true;
    exerciseExists = true;
    insertFails = false;
    vi.clearAllMocks();
  });

  it('valid set data returns 200 with logged set', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('set-uuid-1');
    expect(json.weight_kg).toBe(100);
    expect(json.reps).toBe(8);
  });

  it('weight_kg < 0 returns 400 with weight error message', async () => {
    const res = await POST(makeRequest({ ...validBody, weight_kg: -1 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/weight/i);
  });

  it('weight_kg = -0.01 returns 400', async () => {
    const res = await POST(makeRequest({ ...validBody, weight_kg: -0.01 }));
    expect(res.status).toBe(400);
  });

  it('reps > 999 returns 400 with reps error message', async () => {
    const res = await POST(makeRequest({ ...validBody, reps: 1000 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/reps/i);
  });

  it('rpe = 0 (outside 1-10) returns 400 with rpe error message', async () => {
    const res = await POST(makeRequest({ ...validBody, rpe: 0 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/rpe/i);
  });

  it('rpe = 11 returns 400 with rpe error message', async () => {
    const res = await POST(makeRequest({ ...validBody, rpe: 11 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/rpe/i);
  });

  it('non-existent workout_log_id returns 404', async () => {
    workoutLogExists = false;
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/workout session/i);
  });

  it('non-existent exercise_id returns 404', async () => {
    exerciseExists = false;
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/exercise/i);
  });
});
