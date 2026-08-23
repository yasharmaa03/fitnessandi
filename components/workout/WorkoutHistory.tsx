"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExerciseSummary {
  exercise_name: string;
  muscle_group: string;
  sets_count: number;
  total_volume_kg: number;
}

interface DayEntry {
  date: string;
  workout_log_id: string;
  status: string;
  total_sets: number;
  total_volume_kg: number;
  exercises: ExerciseSummary[];
}

interface WorkoutHistoryProps {
  userId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatExerciseName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-blue-100 text-blue-700",
  back: "bg-green-100 text-green-700",
  legs: "bg-orange-100 text-orange-700",
  shoulders: "bg-purple-100 text-purple-700",
  arms: "bg-yellow-100 text-yellow-700",
  core: "bg-red-100 text-red-700",
  full_body: "bg-gray-100 text-gray-600",
};

// Build 7-day grid (today and past 6 days)
function buildWeekDates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

// ─── Week Strip ───────────────────────────────────────────────────────────────

function WeekStrip({
  days,
  activeDates,
}: {
  days: string[];
  activeDates: Set<string>;
}) {
  const todayStr = today();
  return (
    <div className="flex gap-1.5 justify-between">
      {days.map((d) => {
        const isToday = d === todayStr;
        const hasWorkout = activeDates.has(d);
        const dayName = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
        const dayNum = d.split("-")[2].replace(/^0/, "");

        return (
          <div key={d} className="flex flex-col items-center gap-1">
            <span className="font-caption text-[10px] text-[var(--color-text-3)]">{dayName}</span>
            <div
              className={[
                "w-8 h-8 rounded-full flex items-center justify-center font-metric text-[12px] transition-all",
                hasWorkout
                  ? "bg-[#2563EB] text-white shadow-[0_2px_8px_rgba(37,99,235,.35)]"
                  : isToday
                  ? "border-2 border-[#2563EB] text-[#2563EB]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-3)] border border-[var(--color-border)]",
              ].join(" ")}
            >
              {dayNum}
            </div>
            {hasWorkout && (
              <div className="w-1 h-1 rounded-full bg-[#22C55E]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({ day }: { day: DayEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface-3)] transition-colors text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-body font-bold text-[14px] text-[var(--color-text-1)]">
            {formatDate(day.date)}
          </span>
          <span className="font-caption text-[11px] text-[var(--color-text-3)]">
            {day.exercises.length} exercise{day.exercises.length !== 1 ? "s" : ""} · {day.total_sets} sets
          </span>
        </div>
        <div className="flex items-center gap-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`text-[var(--color-text-3)] transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expanded exercise list */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-[var(--color-border)]">
          <div className="flex flex-col gap-2 pt-3">
            {day.exercises.map((ex) => (
              <div key={ex.exercise_name} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded-full font-caption text-[9px] font-semibold capitalize ${MUSCLE_COLORS[ex.muscle_group] ?? MUSCLE_COLORS.full_body}`}
                  >
                    {ex.muscle_group.replace(/_/g, " ")}
                  </span>
                  <span className="font-body text-[13px] text-[var(--color-text-1)] truncate">
                    {formatExerciseName(ex.exercise_name)}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-caption text-[11px] text-[var(--color-text-3)]">
                    {ex.muscle_group === "full_body"
                      ? `${ex.sets_count} session${ex.sets_count !== 1 ? "s" : ""}`
                      : `${ex.sets_count} set${ex.sets_count !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 justify-between">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-3 w-4 rounded bg-[var(--color-surface-3)] animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-3)] animate-pulse" />
          </div>
        ))}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="h-16 rounded-[14px] bg-[var(--color-surface-2)] animate-pulse border border-[var(--color-border)]" />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkoutHistory({ userId }: WorkoutHistoryProps) {
  const weekDates = buildWeekDates();

  const { data, isLoading, isError, refetch } = useQuery<{ days: DayEntry[] }>({
    queryKey: ["workout-week-history", userId],
    queryFn: async () => {
      const res = await fetch(`/api/workout/week-history?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    enabled: Boolean(userId),
  });

  if (isLoading) return <HistorySkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3">
        <span className="font-body text-[13px] text-red-600">Failed to load history</span>
        <button onClick={() => refetch()} className="font-body text-[13px] text-[#2563EB] underline">
          Retry →
        </button>
      </div>
    );
  }

  const days = data?.days ?? [];
  const activeDates = new Set(days.map((d) => d.date));

  return (
    <div className="flex flex-col gap-4">
      {/* 7-day activity strip */}
      <WeekStrip days={weekDates} activeDates={activeDates} />

      {days.length === 0 ? (
        <p className="font-body text-[13px] text-[var(--color-text-3)] text-center italic py-4">
          No workouts logged in the past 7 days
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
