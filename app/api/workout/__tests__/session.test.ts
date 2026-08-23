import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, PATCH } from '@/app/api/workout/session/route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSession = {
  id: 'session-uuid-1',
  user_id: 'user-1',
  plan_id: 'plan-uuid-1',
  date: '2024-01-15',
  status: 'in_progress',
  notes: null,
  started_at: '2024-01-15T10:00:00Z',
  completed_at: null,
};

const mockCompletedSession = {
  ...mockSession,
  status: 'completed',
  completed_at: '2024-01-15T11:00:00Z',
};

let planExists = true;
let sessionInsertFails = false;
let sessionUpdateFails = false;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'workout_plans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                planExists
                  ? { data: { id: 'plan-uuid-1' }, error: null }
                  : { data: null, error: new Error('not found') }
              ),
            }),
          }),
        };
      }
      if (table === 'workout_logs') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                sessionInsertFails
                  ? { data: null, error: new Error('DB error') }
                  : { data: mockSession, error: null }
              ),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(
                  sessionUpdateFails
                    ? { data: null, error: new Error('DB error') }
                    : { data: mockCompletedSession, error: null }
                ),
              }),
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

function makePost(body: unknown): Request {
  return new Request('http://localhost/api/workout/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatch(body: unknown): Request {
  return new Request('http://localhost/api/workout/session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/workout/session', () => {
  beforeEach(() => {
    planExists = true;
    sessionInsertFails = false;
    vi.clearAllMocks();
  });

  it('valid body with existing plan returns 200 with session data', async () => {
    const res = await POST(
      makePost({ user_id: 'user-1', plan_id: 'plan-uuid-1', date: '2024-01-15' })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('session-uuid-1');
    expect(json.status).toBe('in_progress');
  });

  it('missing plan_id returns 400', async () => {
    const res = await POST(makePost({ user_id: 'user-1', date: '2024-01-15' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/plan_id/i);
  });

  it('non-existent plan_id returns 404', async () => {
    planExists = false;
    const res = await POST(
      makePost({ user_id: 'user-1', plan_id: 'nonexistent', date: '2024-01-15' })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/plan/i);
  });

  it('missing user_id field returns 401', async () => {
    const res = await POST(makePost({ plan_id: 'plan-uuid-1', date: '2024-01-15' }));
    expect(res.status).toBe(401);
  });

  it('empty user_id string returns 400', async () => {
    const res = await POST(makePost({ user_id: '', plan_id: 'plan-uuid-1', date: '2024-01-15' }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/workout/session', () => {
  beforeEach(() => {
    sessionUpdateFails = false;
    vi.clearAllMocks();
  });

  it('status "completed" returns 200 with completed_at set', async () => {
    const res = await PATCH(makePatch({ id: 'session-uuid-1', status: 'completed' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('completed');
    expect(json.completed_at).toBeTruthy();
  });

  it('status "abandoned" returns 200', async () => {
    const res = await PATCH(makePatch({ id: 'session-uuid-1', status: 'abandoned' }));
    expect(res.status).toBe(200);
  });

  it('invalid status "in_progress" returns 400', async () => {
    const res = await PATCH(makePatch({ id: 'session-uuid-1', status: 'in_progress' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid status/i);
  });

  it('invalid status "active" returns 400', async () => {
    const res = await PATCH(makePatch({ id: 'session-uuid-1', status: 'active' }));
    expect(res.status).toBe(400);
  });

  it('missing id returns 400', async () => {
    const res = await PATCH(makePatch({ status: 'completed' }));
    expect(res.status).toBe(400);
  });
});
