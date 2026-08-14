"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import GlowCard from "@/components/ui/GlowCard";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { computeOneRepMax } from "@/lib/workout/calculations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgressHistoryProps {
  userId: string;
  exerciseFilter?: string; // Optional: filter to single exercise
}

interface WorkoutSummary {
  id: string;
  date: string;
  plan_name: string;
  duration_seconds: number | null;
  total_volume: number;
  set_count: number;
  status: string;
}

interface HistoryResponse {
  workouts: WorkoutSummary[];
}

interface SetWithExercise {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  logged_at: string;
  exercise_name: string;
  exercise_media_url: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  // dateStr from API is "YYYY-MM-DD"
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

// ---------------------------------------------------------------------------
// Loading skeleton (3 row placeholders, matching nutrition section pattern)
// ---------------------------------------------------------------------------

function WorkoutHistorySkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Loading workout history"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-3.5 w-1/3 rounded-full bg-[var(--color-surface-3)]" />
              <div className="h-2.5 w-1/2 rounded-full bg-[var(--color-surface-3)]" />
            </div>
            <div className="h-8 w-16 rounded-[10px] bg-[var(--color-surface-3)]" />
          </div>
          <div className="flex gap-4">
            <div className="h-2.5 w-20 rounded-full bg-[var(--color-surface-3)]" />
            <div className="h-2.5 w-16 rounded-full bg-[var(--color-surface-3)]" />
            <div className="h-2.5 w-14 rounded-full bg-[var(--color-surface-3)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline ErrorBanner (matching MealHistory pattern)
// ---------------------------------------------------------------------------

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[#DC2626]"
    >
      <span className="font-body text-[13px]">⚠ {message}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        Retry →
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Volume Line Chart (last 12 weeks)
// ---------------------------------------------------------------------------

interface ChartPoint {
  weekLabel: string;
  volume: number;
}

function VolumeChart({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) return null;

  const W = 320;
  const H = 80;
  const PAD_X = 4;
  const PAD_Y = 8;

  const volumes = points.map((p) => p.volume);
  const minV = Math.min(...volumes);
  const maxV = Math.max(...volumes);
  const range = maxV - minV || 1;

  const toX = (i: number) =>
    PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
  const toY = (v: number) =>
    H - PAD_Y - ((v - minV) / range) * (H - PAD_Y * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.volume).toFixed(1)}`)
    .join(" ");

  // Filled area under the line
  const areaD =
    `${pathD} L ${toX(points.length - 1).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`;

  const firstLabel = points[0].weekLabel;
  const lastLabel = points[points.length - 1].weekLabel;
  const maxPoint = points.reduce((a, b) => (a.volume > b.volume ? a : b));
  const maxIdx = points.indexOf(maxPoint);

  return (
    <div className="mt-4" aria-label="Volume over the last 12 weeks">
      <p className="font-caption text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Volume trend (last 12 weeks)
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Weekly training volume from ${firstLabel} to ${lastLabel}. Peak: ${formatVolume(maxPoint.volume)} in week of ${maxPoint.weekLabel}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Filled area */}
        <path d={areaD} fill="url(#volumeGradient)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#2563EB"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(p.volume)}
            r="3"
            fill="#2563EB"
            aria-label={`${p.weekLabel}: ${formatVolume(p.volume)}`}
          />
        ))}

        {/* Peak label */}
        <text
          x={toX(maxIdx)}
          y={Math.max(toY(maxPoint.volume) - 6, 12)}
          textAnchor={maxIdx < points.length / 2 ? "start" : "end"}
          fontSize="9"
          fill="#2563EB"
          fontWeight="600"
        >
          {formatVolume(maxPoint.volume)}
        </text>
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between mt-1">
        <span className="font-caption text-[10px] text-[var(--color-text-secondary)]">
          {firstLabel}
        </span>
        <span className="font-caption text-[10px] text-[var(--color-text-secondary)]">
          {lastLabel}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lazy media player — loads only when toggled visible
// ---------------------------------------------------------------------------

function LazyMediaPlayer({ url, exerciseName }: { url: string; exerciseName: string }) {
  const [loaded, setLoaded] = useState(false);
  const isVideo = url.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="mt-3 rounded-[12px] overflow-hidden border border-[var(--color-border)]">
      {!loaded && (
        <div className="h-40 animate-pulse bg-[var(--color-surface-2)]" aria-label="Loading media" />
      )}
      {isVideo ? (
        <video
          src={url}
          controls
          className={`w-full max-h-64 object-contain ${loaded ? "" : "hidden"}`}
          onLoadedData={() => setLoaded(true)}
          aria-label={`Exercise video for ${exerciseName}`}
        />
      ) : (
        <img
          src={url}
          alt={`Exercise demonstration for ${exerciseName}`}
          loading="lazy"
          className={`w-full max-h-64 object-contain ${loaded ? "" : "hidden"}`}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded session: sets grouped by exercise
// ---------------------------------------------------------------------------

interface ExpandedSessionProps {
  workoutId: string;
}

function ExpandedSession({ workoutId }: ExpandedSessionProps) {
  const supabase = createClient();
  const [showMedia, setShowMedia] = useState<Record<string, boolean>>({});

  const { data: sets, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["workout-session-sets", workoutId],
    queryFn: async (): Promise<SetWithExercise[]> => {
      const { data, error } = await supabase
        .from("logged_sets")
        .select(`
          id,
          workout_log_id,
          exercise_id,
          set_number,
          weight_kg,
          reps,
          rpe,
          logged_at,
          exercises!inner(name, media_url)
        `)
        .eq("workout_log_id", workoutId)
        .order("logged_at", { ascending: true });

      if (error) throw error;

      // Supabase's inferred type for joined tables is loose — cast through unknown
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        workout_log_id: string;
        exercise_id: string;
        set_number: number;
        weight_kg: number;
        reps: number;
        rpe: number | null;
        logged_at: string;
        exercises: { name: string; media_url: string | null };
      }>;

      return rows.map((row) => ({
        id: row.id,
        workout_log_id: row.workout_log_id,
        exercise_id: row.exercise_id,
        set_number: row.set_number,
        weight_kg: row.weight_kg,
        reps: row.reps,
        rpe: row.rpe,
        logged_at: row.logged_at,
        exercise_name: row.exercises.name,
        exercise_media_url: row.exercises.media_url,
      }));
    },
    staleTime: 30_000,
    enabled: Boolean(workoutId),
  });

  if (isLoading) {
    return (
      <div className="mt-4 flex flex-col gap-2 animate-pulse" aria-busy="true" aria-label="Loading session sets">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-9 rounded-[10px] bg-[var(--color-surface-3)]"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    const msg =
      error instanceof Error ? error.message : "Failed to load session sets";
    return <ErrorBanner message={msg} onRetry={refetch} />;
  }

  if (!sets || sets.length === 0) {
    return (
      <p className="mt-4 font-body text-[13px] text-[var(--color-text-secondary)] italic">
        No sets recorded for this session.
      </p>
    );
  }

  // Group sets by exercise name
  const grouped = new Map<string, SetWithExercise[]>();
  for (const s of sets) {
    const key = s.exercise_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  // Compute personal records: highest weight per exercise across all sets in this session
  const sessionPRs = new Map<string, number>();
  for (const [exName, exSets] of grouped) {
    sessionPRs.set(exName, Math.max(...exSets.map((s) => s.weight_kg)));
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {Array.from(grouped.entries()).map(([exName, exSets]) => {
        const prWeight = sessionPRs.get(exName) ?? 0;
        return (
          <section key={exName} aria-labelledby={`ex-${exName.replace(/\s+/g, "-")}`}>
            <div className="flex items-center mb-2">
              <h4
                id={`ex-${exName.replace(/\s+/g, "-")}`}
                className="font-body font-semibold text-[13px] text-[var(--color-text-primary)] capitalize"
              >
                {exName}
              </h4>
              {exSets[0]?.exercise_media_url && (
                <button
                  onClick={() => setShowMedia(prev => ({ ...prev, [exName]: !prev[exName] }))}
                  className="ml-auto font-caption text-[11px] text-[#2563EB] underline underline-offset-2"
                  aria-label={showMedia[exName] ? `Hide video for ${exName}` : `Show video for ${exName}`}
                >
                  {showMedia[exName] ? "Hide video" : "Show video"}
                </button>
              )}
            </div>
            <div
              className="flex flex-col gap-1.5"
              role="list"
              aria-label={`Sets for ${exName}`}
            >
              {exSets.map((s) => {
                const isPersonalRecord = s.weight_kg === prWeight && s.weight_kg > 0;
                // Only show 1RM estimate for reps 1-10 (Epley is reliable in this range)
                const showORM = s.reps >= 1 && s.reps <= 10;
                const orm = showORM
                  ? computeOneRepMax(s.weight_kg, s.reps)
                  : null;

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                    role="listitem"
                    aria-label={`Set ${s.set_number}: ${s.weight_kg} kg × ${s.reps} reps${s.rpe != null ? `, RPE ${s.rpe}` : ""}${isPersonalRecord ? ", personal record" : ""}`}
                  >
                    <span className="font-caption text-[11px] text-[var(--color-text-secondary)] min-w-[32px]">
                      #{s.set_number}
                    </span>

                    <span className="font-body font-semibold text-[13px] text-[var(--color-text-primary)]">
                      {s.weight_kg} kg × {s.reps}
                    </span>

                    {s.rpe != null && (
                      <span className="font-caption text-[11px] text-[var(--color-text-secondary)]">
                        RPE {s.rpe}
                      </span>
                    )}

                    {orm != null && (
                      <span
                        className="font-caption text-[11px] text-[var(--color-text-secondary)]"
                        aria-label={`Estimated one rep max: ${orm.toFixed(1)} kg`}
                      >
                        ~{orm.toFixed(1)} kg 1RM
                      </span>
                    )}

                    {isPersonalRecord && (
                      <span
                        className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] border border-[#FCD34D] px-2 py-0.5 font-caption text-[10px] font-bold text-[#92400E]"
                        aria-label="Personal record"
                        title="Personal record — highest weight for this exercise"
                      >
                        🏆 PR
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {showMedia[exName] && exSets[0]?.exercise_media_url && (
              <LazyMediaPlayer
                url={exSets[0].exercise_media_url}
                exerciseName={exName}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single session row with expand/collapse
// ---------------------------------------------------------------------------

interface SessionRowProps {
  workout: WorkoutSummary;
  isExpanded: boolean;
  onToggle: () => void;
}

function SessionRow({ workout, isExpanded, onToggle }: SessionRowProps) {
  return (
    <GlowCard className="overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        className="w-full flex items-start justify-between gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-inset rounded-[18px]"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`session-detail-${workout.id}`}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} workout on ${formatDate(workout.date)}`}
      >
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="font-body font-semibold text-[14px] text-[var(--color-text-primary)] truncate">
            {workout.plan_name}
          </span>
          <span className="font-caption text-[12px] text-[var(--color-text-secondary)]">
            {formatDate(workout.date)}
          </span>

          {/* Metrics row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span
              className="font-caption text-[11px] text-[var(--color-text-secondary)]"
              aria-label={`Duration: ${formatDuration(workout.duration_seconds)}`}
            >
              ⏱ {formatDuration(workout.duration_seconds)}
            </span>
            <span
              className="font-caption text-[11px] text-[var(--color-text-secondary)]"
              aria-label={`Total volume: ${formatVolume(workout.total_volume)}`}
            >
              🏋️ {formatVolume(workout.total_volume)}
            </span>
            <span
              className="font-caption text-[11px] text-[var(--color-text-secondary)]"
              aria-label={`${workout.set_count} sets completed`}
            >
              📊 {workout.set_count} sets
            </span>
          </div>
        </div>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="mt-1 shrink-0 text-[var(--color-text-secondary)] text-[16px]"
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`session-detail-${workout.id}`}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <div
                className="border-t border-[var(--color-border)] pt-4"
                role="region"
                aria-label={`Sets for workout on ${formatDate(workout.date)}`}
              >
                <ExpandedSession workoutId={workout.id} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlowCard>
  );
}

// ---------------------------------------------------------------------------
// Build chart points for last 12 weeks from workout history
// ---------------------------------------------------------------------------

function buildChartPoints(workouts: WorkoutSummary[]): ChartPoint[] {
  if (workouts.length === 0) return [];

  // Determine the Monday of the current week
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const daysToMonday = (day === 0 ? 6 : day - 1);
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  const WEEKS = 12;
  const points: ChartPoint[] = [];

  for (let w = WEEKS - 1; w >= 0; w--) {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() - w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Sum volume for all workouts in this week
    const weekVolume = workouts
      .filter((wo) => {
        const [y, m, d] = wo.date.split("-").map(Number);
        const woDate = new Date(y, m - 1, d);
        return woDate >= weekStart && woDate <= weekEnd;
      })
      .reduce((sum, wo) => sum + wo.total_volume, 0);

    const monthShort = weekStart.toLocaleDateString(undefined, { month: "short" });
    const dayNum = weekStart.getDate();
    points.push({ weekLabel: `${monthShort} ${dayNum}`, volume: weekVolume });
  }

  return points;
}

// ---------------------------------------------------------------------------
// ProgressHistory — main export
// ---------------------------------------------------------------------------

async function fetchWorkoutHistory(userId: string): Promise<HistoryResponse> {
  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const params = new URLSearchParams({ 
    userId,
    startDate, // Only fetch workouts from last 7 days
  });
  const res = await fetch(`/api/workout/history?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to load workout history");
  }
  return res.json() as Promise<HistoryResponse>;
}

export default function ProgressHistory({
  userId,
  exerciseFilter,
}: ProgressHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["workout-history", userId],
    queryFn: () => fetchWorkoutHistory(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  // Debug logging
  console.log('[ProgressHistory] Query state:', {
    userId,
    isLoading,
    isError,
    error: error?.message,
    workoutsCount: data?.workouts?.length,
    workouts: data?.workouts,
  });

  // Loading state
  if (isLoading) {
    return <WorkoutHistorySkeleton />;
  }

  // Error state
  if (isError) {
    const message =
      error instanceof Error ? error.message : "Failed to load workout history";
    return <ErrorBanner message={message} onRetry={refetch} />;
  }

  const allWorkouts = data?.workouts ?? [];

  // Filter to completed OR in_progress sessions (manual workouts may stay in_progress)
  const workouts = allWorkouts.filter((wo) => {
    // Show both completed and in_progress workouts (manual workouts often stay in_progress)
    if (wo.status !== "completed" && wo.status !== "in_progress") return false;
    if (exerciseFilter) {
      return wo.plan_name.toLowerCase().includes(exerciseFilter.toLowerCase());
    }
    return true;
  });

  // Empty state
  if (workouts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center"
        role="status"
        aria-label="No workout history"
      >
        <span className="text-[36px]" aria-hidden="true">
          🏋️
        </span>
        <p className="font-body text-[15px] font-semibold text-[var(--color-text-primary)]">
          No workout history yet.
        </p>
        <p className="font-body text-[13px] text-[var(--color-text-secondary)]">
          Start logging to see your progress!
        </p>
      </div>
    );
  }

  // Build volume chart data
  const chartPoints = buildChartPoints(workouts);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section aria-label="Workout history and progress">
      {/* Volume chart — shown when ≥ 2 data points have non-zero volume */}
      {chartPoints.filter((p) => p.volume > 0).length >= 2 && (
        <GlowCard className="p-5 mb-5">
          <VolumeChart points={chartPoints} />
        </GlowCard>
      )}

      {/* Session list */}
      <div
        className="flex flex-col gap-3"
        role="list"
        aria-label="Completed workout sessions"
      >
        {workouts.map((workout) => (
          <div key={workout.id} role="listitem">
            <SessionRow
              workout={workout}
              isExpanded={expandedId === workout.id}
              onToggle={() => toggleExpand(workout.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
