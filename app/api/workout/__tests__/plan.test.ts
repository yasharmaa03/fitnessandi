import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/workout/plan/route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPlan = {
  id: 'plan-uuid-1',
  user_id: 'user-1',
  name: 'Push Day',
  description: null,
  is_template: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockExercises = [
  {
    id: 'pe-uuid-1',
    plan_id: 'plan-uuid-1',
    exercise_id: 'ex-uuid-1',
    target_sets: 3,
    target_reps: 10,
    rest_seconds: 90,
    order_index: 0,
  },
];

// Track calls for assertion
let insertCallCount = 0;
let lastFromTable = '';
let shouldPlanInsertFail = false;

const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

const mockInsert = vi.fn().mockImplementation(() => {
  insertCallCount++;
  return {
    select: () => ({
      single: mockSingle,
      then: undefined,
    }),
  };
});

// Special insert that returns array (no .single())
const mockInsertArray = vi.fn().mockReturnValue({
  select: () => Promise.resolve({ data: mockExercises, error: null }),
});

const mockDelete = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      lastFromTable = table;
      if (table === 'workout_plans') {
        return {
          insert: vi.fn().mockReturnValue({
            select: () => ({
              single: () =>
                shouldPlanInsertFail
                  ? Promise.resolve({ data: null, error: new Error('DB error') })
                  : Promise.resolve({ data: mockPlan, error: null }),
            }),
          }),
          delete: mockDelete,
        };
      }
      if (table === 'plan_exercises') {
        return {
          insert: vi.fn().mockReturnValue({
            select: () => Promise.resolve({ data: mockExercises, error: null }),
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
  return new Request('http://localhost/api/workout/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  user_id: 'user-1',
  name: 'Push Day',
  exercises: [
    {
      exercise_id: 'ex-uuid-1',
      target_sets: 3,
      target_reps: 10,
      rest_seconds: 90,
      order_index: 0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/workout/plan', () => {
  beforeEach(() => {
    insertCallCount = 0;
    shouldPlanInsertFail = false;
    vi.clearAllMocks();
  });

  it('valid input returns 200 with plan and exercises', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('plan-uuid-1');
    expect(json.name).toBe('Push Day');
    expect(Array.isArray(json.exercises)).toBe(true);
    expect(json.exercises).toHaveLength(1);
  });

  it('missing name returns 400', async () => {
    const body = { ...validBody, name: undefined };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('empty exercises array returns 400', async () => {
    const body = { ...validBody, exercises: [] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/exercise/i);
  });

  it('missing user_id returns 401', async () => {
    const { user_id: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/auth/i);
  });

  it('database error on plan insert returns 500', async () => {
    shouldPlanInsertFail = true;
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
