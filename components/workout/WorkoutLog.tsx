"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetRow {
  id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  logged_at: string;
}

interface ExerciseEntry {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  equipment: string;
  sets: SetRow[];
}

interface DailyLogResponse {
  workout_log_id: string | null;
  exercises: ExerciseEntry[];
}

interface WorkoutLogProps {
  userId: string;
  date: string;
  onLogWorkout: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatExerciseName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  back: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  legs: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  shoulders: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  arms: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  core: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  full_body: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

function getMuscleColor(mg: string) {
  return MUSCLE_COLORS[mg] ?? MUSCLE_COLORS.full_body;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function WorkoutLogSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <div className="h-4 w-2/5 rounded-full bg-[var(--color-surface-3)] mb-3" />
          <div className="h-3 w-full rounded-full bg-[var(--color-surface-3)] mb-2" />
          <div className="h-3 w-4/5 rounded-full bg-[var(--color-surface-3)]" />
        </div>
      ))}
    </div>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  entry,
  workoutLogId,
  userId,
  onDelete,
  isDeleting,
}: {
  entry: ExerciseEntry;
  workoutLogId: string;
  userId: string;
  onDelete: (exerciseId: string) => void;
  isDeleting: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
      {/* Exercise header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full font-caption text-[10px] font-semibold capitalize ${getMuscleColor(entry.muscle_group)}`}
          >
            {entry.muscle_group.replace(/_/g, " ")}
          </span>
          <span className="font-body font-bold text-[14px] text-[var(--color-text-1)] truncate">
            {formatExerciseName(entry.exercise_name)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={isDeleting}
          onClick={() => onDelete(entry.exercise_id)}
          aria-label={`Delete ${entry.exercise_name}`}
          className="shrink-0 text-[#EF4444] border-[#FCA5A5] hover:bg-red-50 dark:hover:bg-red-950/30 h-8 px-2"
        >
          {!isDeleting && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          )}
        </Button>
      </div>

      {/* Sets table */}
      <div className="px-4 py-3">
        {/* Header row */}
        <div className="grid grid-cols-[24px_1fr_1fr_1fr] gap-2 mb-2">
          {(entry.muscle_group === "full_body"
            ? ["#", "Weight", "Time", "RPE"]
            : ["#", "Weight", "Reps", "RPE"]
          ).map((h) => (
            <span key={h} className="font-caption text-[10px] uppercase tracking-widest text-[var(--color-text-3)] text-center">
              {h}
            </span>
          ))}
        </div>

        {/* Set rows */}
        <div className="flex flex-col gap-1.5">
          {entry.sets.map((set) => (
            <div key={set.id} className="grid grid-cols-[24px_1fr_1fr_1fr] gap-2 items-center">
              <span className="font-metric text-[12px] text-[var(--color-text-3)] text-center">{set.set_number}</span>
              <span className="font-metric text-[13px] text-[var(--color-text-1)] text-center">
                {entry.muscle_group === "full_body" ? "BW" : `${set.weight_kg}kg`}
              </span>
              <span className="font-metric text-[13px] text-[var(--color-text-1)] text-center">
                {entry.muscle_group === "full_body" ? `${set.reps} min` : set.reps}
              </span>
              <span className="font-metric text-[13px] text-[var(--color-text-3)] text-center">{set.rpe ?? "—"}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <span className="font-caption text-[11px] text-[var(--color-text-3)]">
            {entry.muscle_group === "full_body"
              ? `${entry.sets.length} session${entry.sets.length !== 1 ? "s" : ""}`
              : `${entry.sets.length} set${entry.sets.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkoutLog({ userId, date, onLogWorkout }: WorkoutLogProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<DailyLogResponse>({
    queryKey: ["workout-daily-log", userId, date],
    queryFn: async () => {
      const params = new URLSearchParams({ userId, date });
      const res = await fetch(`/api/workout/daily-log?${params}`);
      if (!res.ok) throw new Error("Failed to load workout log");
      return res.json();
    },
    enabled: Boolean(userId) && Boolean(date),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ exerciseId }: { exerciseId: string }) => {
      const res = await fetch("/api/workout/log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workout_log_id: data?.workout_log_id,
          exercise_id: exerciseId,
          user_id: userId,
        }),
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-daily-log", userId, date] });
      queryClient.invalidateQueries({ queryKey: ["workout-week-history", userId] });
    },
  });

  if (isLoading) return <WorkoutLogSkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3">
        <span className="font-body text-[13px] text-red-600">Failed to load workout log</span>
        <button onClick={() => refetch()} className="font-body text-[13px] text-[#2563EB] underline">
          Retry →
        </button>
      </div>
    );
  }

  const exercises = data?.exercises ?? [];

  const deletingExerciseId = deleteMutation.isPending
    ? (deleteMutation.variables as { exerciseId: string } | undefined)?.exerciseId ?? null
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Log button */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-widest">
          {exercises.length === 0 ? "No exercises logged yet" : `${exercises.length} exercise${exercises.length !== 1 ? "s" : ""} today`}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogWorkout}
        >
          + Log Exercise
        </Button>
      </div>

      {/* Empty state */}
      {exercises.length === 0 && (
        <div
          onClick={onLogWorkout}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onLogWorkout()}
          className="flex flex-col items-center gap-3 py-8 rounded-[14px] border-2 border-dashed border-[var(--color-border)] cursor-pointer hover:border-[#2563EB]/40 transition-colors"
        >

          <p className="font-body text-[14px] text-[var(--color-text-2)] text-center max-w-xs">
            Search and log exercises with sets, reps and weight
          </p>
        </div>
      )}

      {/* Exercise list */}
      {exercises.map((entry) => (
        <ExerciseCard
          key={entry.exercise_id}
          entry={entry}
          workoutLogId={data!.workout_log_id!}
          userId={userId}
          onDelete={(exerciseId) => deleteMutation.mutate({ exerciseId })}
          isDeleting={deletingExerciseId === entry.exercise_id}
        />
      ))}
    </div>
  );
}
