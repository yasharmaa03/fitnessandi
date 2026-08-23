import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/workout/history/route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogs = [
  {
    id: 'log-uuid-1',
    user_id: 'user-1',
    plan_id: 'plan-uuid-1',
    date: '2024-01-15',
    status: 'completed',
    notes: null,
    started_at: '2024-01-15T10:00:00Z',
    completed_at: '2024-01-15T11:00:00Z',
    workout_plans: { name: 'Push Day' },
    logged_sets: [
      { weight_kg: 100, reps: 8 },
      { weight_kg: 100, reps: 8 },
      { weight_kg: 100, reps: 6 },
    ],
  },
];

let queryError = false;
let capturedFilters: Record<string, unknown> = {};

// Chainable mock builder
function makeQueryChain(data: unknown[], error: boolean) {
  const chain: Record<string, unknown> = {};

  const terminal = () =>
    Promise.resolve(error ? { data: null, error: new Error('DB error') } : { data, error: null });

  chain.eq = vi.fn((_col: string, _val: unknown) => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn((n: number) => {
    capturedFilters['limit'] = n;
    return chain;
  });
  chain.gte = vi.fn((col: string, val: unknown) => {
    capturedFilters[`gte_${col}`] = val;
    return chain;
  });
  chain.lte = vi.fn((col: string, val: unknown) => {
    capturedFilters[`lte_${col}`] = val;
    return chain;
  });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(terminal()).then(resolve);

  // Make it thenable so await works
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });

  return new Proxy(chain, {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return terminal().then.bind(terminal());
      }
      return target[prop as string];
    },
  });
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'workout_logs') {
        return {
          select: vi.fn(() => makeQueryChain(mockLogs, queryError)),
        };
      }
      return {};
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/workout/history');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/workout/history', () => {
  beforeEach(() => {
    queryError = false;
    capturedFilters = {};
    vi.clearAllMocks();
  });

  it('valid userId returns 200 with workouts array', async () => {
    const res = await GET(makeRequest({ userId: 'user-1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.workouts)).toBe(true);
    expect(json.workouts).toHaveLength(1);
    expect(json.workouts[0].id).toBe('log-uuid-1');
    // Volume: (100*8) + (100*8) + (100*6) = 2200
    expect(json.workouts[0].total_volume).toBe(2200);
    expect(json.workouts[0].plan_name).toBe('Push Day');
    // Duration: 3600 seconds (1 hour)
    expect(json.workouts[0].duration_seconds).toBe(3600);
  });

  it('missing userId returns 401', async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/auth/i);
  });

  it('limit=300 (over 200) returns 400', async () => {
    const res = await GET(makeRequest({ userId: 'user-1', limit: '300' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/limit/i);
  });

  it('invalid limit string returns 400', async () => {
    const res = await GET(makeRequest({ userId: 'user-1', limit: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('only returns workouts for the requesting user', async () => {
    const res = await GET(makeRequest({ userId: 'user-1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    json.workouts.forEach((w: { id: string }) => {
      // All returned workouts are from mockLogs which has user_id 'user-1'
      const log = mockLogs.find((l) => l.id === w.id);
      expect(log?.user_id).toBe('user-1');
    });
  });

  it('startDate filter is applied in query', async () => {
    await GET(makeRequest({ userId: 'user-1', startDate: '2024-01-01' }));
    expect(capturedFilters['gte_date']).toBe('2024-01-01');
  });

  it('endDate filter is applied in query', async () => {
    await GET(makeRequest({ userId: 'user-1', endDate: '2024-01-31' }));
    expect(capturedFilters['lte_date']).toBe('2024-01-31');
  });

  it('custom limit is applied in query', async () => {
    await GET(makeRequest({ userId: 'user-1', limit: '10' }));
    expect(capturedFilters['limit']).toBe(10);
  });
});
