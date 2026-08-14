"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ML_SERVICE_URL =
  process.env.NEXT_PUBLIC_ML_SERVICE_URL ?? "http://localhost:8001";

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  chest: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  back: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  legs: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  shoulders:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  arms: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  core: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  full_body:
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkoutRecommendationProps {
  userId: string;
  date: string; // YYYY-MM-DD
  onStartWorkout?: (planId: string) => void; // Made optional
}

interface RecommendedExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  target_sets: number;
  target_reps: number;
  suggested_weight_kg: number;
  rest_seconds: number;
  rationale: string;
}

interface RecommendationResponse {
  recommended_exercises: RecommendedExercise[];
  plan_metadata: {
    total_exercises: number;
    estimated_duration_minutes: number;
    focus_areas: string[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capitalize and replace underscores with spaces for display. */
function formatExerciseName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getMuscleGroupColor(muscleGroup: string): string {
  return (
    MUSCLE_GROUP_COLORS[muscleGroup.toLowerCase()] ??
    MUSCLE_GROUP_COLORS.full_body
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — 3 animate-pulse card placeholders
// ---------------------------------------------------------------------------

function RecommendationSkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Loading workout recommendation"
    >
      {/* Exercise card skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="h-5 w-16 rounded-full bg-[var(--color-surface-3)]" />
            <div className="h-5 w-2/5 rounded-full bg-[var(--color-surface-3)]" />
          </div>
          <div className="flex gap-4 mb-2">
            <div className="h-4 w-20 rounded-full bg-[var(--color-surface-3)]" />
            <div className="h-4 w-16 rounded-full bg-[var(--color-surface-3)]" />
          </div>
          <div className="h-3 w-full rounded-full bg-[var(--color-surface-3)]" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

async function fetchRecommendation(
  userId: string,
  date: string
): Promise<RecommendationResponse> {
  const res = await fetch(`${ML_SERVICE_URL}/workout/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, date }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to load workout recommendation");
  }
  return res.json() as Promise<RecommendationResponse>;
}

// ---------------------------------------------------------------------------
// WorkoutRecommendation — main export
// ---------------------------------------------------------------------------

export default function WorkoutRecommendation({
  userId,
  date,
  onStartWorkout,
}: WorkoutRecommendationProps) {
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate plan function
  const generatePlan = async () => {
    setIsGenerating(true);
    setPlanError(null);
    try {
      const data = await fetchRecommendation(userId, date);
      setRecommendations(data);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Couldn't generate workout plan — try again");
      setRecommendations(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const exercises = recommendations?.recommended_exercises ?? [];
  const metadata = recommendations?.plan_metadata;

  // Parse weekly split from focus_areas metadata
  const getWeeklySplit = (): { splitName: string; schedule: Array<{ day: string; workout: string }> } | null => {
    if (!metadata?.focus_areas) return null;

    // Find the weekly_split info in focus_areas
    const splitInfo = metadata.focus_areas.find(area => area.startsWith('weekly_split:'));
    if (!splitInfo) return null;

    const splitName = splitInfo.replace('weekly_split:', '');
    
    // Parse day schedule from focus_areas (format: "day_0:upper", "day_1:lower", etc.)
    const daySchedule = metadata.focus_areas
      .filter(area => area.startsWith('day_'))
      .map(area => {
        const [dayPart, workout] = area.split(':');
        const dayIndex = parseInt(dayPart.replace('day_', ''));
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return {
          day: dayNames[dayIndex],
          workout: workout === 'rest' ? 'Rest' : formatExerciseName(workout),
        };
      });

    return {
      splitName: formatSplitName(splitName),
      schedule: daySchedule,
    };
  };

  const formatSplitName = (splitKey: string): string => {
    return splitKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  };

  const weeklySplit = getWeeklySplit();
  const isRestDay = exercises.length === 0 && metadata?.focus_areas?.includes('rest');

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={isGenerating}
        loading={isGenerating}
        onClick={generatePlan}
      >
        Generate Plan
      </Button>

      {isGenerating && <RecommendationSkeleton />}

      {planError !== null && !isGenerating && (
        <p
          role="alert"
          className="text-[13px] font-body text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[10px] px-4 py-3"
        >
          {planError}
        </p>
      )}

      {!isGenerating && (exercises.length > 0 || isRestDay) && (
        <div className="flex flex-col gap-3">
          {/* Weekly Training Split Schedule */}
          {weeklySplit && (
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <h3 className="font-body font-bold text-[13px] text-[var(--color-text-1)] mb-3">
                📅 Weekly Training Split: {weeklySplit.splitName}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {weeklySplit.schedule.map((item, index) => {
                  // Backend uses 0=Monday (Python weekday), frontend Date.getDay() uses 0=Sunday
                  // Convert: frontend getDay() 0=Sun,1=Mon...6=Sat -> backend 0=Mon...6=Sun
                  const jsDay = new Date(date).getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
                  const pythonDay = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Monday, ..., 6=Sunday
                  const isToday = pythonDay === index;
                  const isRest = item.workout === 'Rest';
                  
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded-[10px] ${
                        isToday 
                          ? 'bg-[#2563EB] border border-[#1D4ED8]' 
                          : 'bg-[var(--color-surface)] border border-[var(--color-border)]'
                      }`}
                    >
                      <span className={`font-body text-[12px] font-semibold ${
                        isToday ? 'text-white' : 'text-[var(--color-text-1)]'
                      }`}>
                        {item.day}
                      </span>
                      <span className={`font-caption text-[11px] ${
                        isToday 
                          ? 'text-white' 
                          : isRest 
                            ? 'text-[var(--color-text-3)]' 
                            : 'text-[var(--color-text-2)]'
                      }`}>
                        {isToday && '→ '}{item.workout}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rest Day Message */}
          {isRestDay && (
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 text-center">
              <span className="text-[36px] mb-2 block">🛌</span>
              <p className="font-body font-bold text-[15px] text-[var(--color-text-1)] mb-1">
                Rest Day
              </p>
              <p className="font-body text-[13px] text-[var(--color-text-2)]">
                Recovery is essential for muscle growth and strength gains.
              </p>
            </div>
          )}

          {/* Today's Workout - Plan metadata header */}
          {exercises.length > 0 && metadata && (
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <h3 className="font-body font-bold text-[13px] text-[var(--color-text-1)] mb-3">
                💪 Today's Workout
              </h3>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3">
                <span
                  className="font-caption text-[12px] text-[var(--color-text-3)]"
                  aria-label={`Estimated duration: ${metadata.estimated_duration_minutes} minutes`}
                >
                  ⏱ ~{metadata.estimated_duration_minutes} min
                </span>
                {metadata.focus_areas.filter(a => !a.startsWith('day_') && !a.startsWith('weekly_split:')).length > 0 && (
                  <span
                    className="font-caption text-[12px] text-[var(--color-text-3)]"
                    aria-label={`Focus areas: ${metadata.focus_areas.filter(a => !a.startsWith('day_') && !a.startsWith('weekly_split:')).join(", ")}`}
                  >
                    🎯 {metadata.focus_areas.filter(a => !a.startsWith('day_') && !a.startsWith('weekly_split:')).map((a) => formatExerciseName(a)).join(", ")}
                  </span>
                )}
              </div>
              {metadata.focus_areas.filter(a => !a.startsWith('day_') && !a.startsWith('weekly_split:') && a !== 'rest').length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Focus muscle groups">
                  {metadata.focus_areas.filter(a => !a.startsWith('day_') && !a.startsWith('weekly_split:') && a !== 'rest').map((area) => (
                    <span
                      key={area}
                      className={`inline-block rounded-full px-2 py-0.5 font-caption text-[10px] font-semibold uppercase tracking-wide ${getMuscleGroupColor(area)}`}
                    >
                      {formatExerciseName(area)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Exercise cards */}
          {exercises.map((exercise, index) => {
            const badgeColor = getMuscleGroupColor(exercise.muscle_group);
            
            return (
              <div
                key={index}
                className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-3"
              >
                {/* Header: name + muscle group badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-caption text-[10px] font-semibold uppercase tracking-wide ${badgeColor}`}
                  >
                    {formatExerciseName(exercise.muscle_group)}
                  </span>
                  <p className="font-body font-bold text-[15px] text-[var(--color-text-1)]">
                    {formatExerciseName(exercise.exercise_name)}
                  </p>
                </div>

                {/* Sets × reps + weight */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span
                    className="font-body font-semibold text-[13px] text-[var(--color-text-1)]"
                    aria-label={`${exercise.target_sets} sets of ${exercise.target_reps} reps`}
                  >
                    {exercise.target_sets} × {exercise.target_reps} reps
                  </span>
                  <span
                    className="font-caption text-[12px] text-[var(--color-text-2)]"
                    aria-label={`Suggested weight: ${exercise.suggested_weight_kg} kg`}
                  >
                    🏋️ {exercise.suggested_weight_kg} kg
                  </span>
                  <span
                    className="font-caption text-[11px] text-[var(--color-text-3)]"
                    aria-label={`Rest: ${exercise.rest_seconds} seconds`}
                  >
                    ⏸ {exercise.rest_seconds}s rest
                  </span>
                </div>

                {/* Rationale */}
                {exercise.rationale && (
                  <p className="font-body text-[13px] text-[var(--color-text-2)]">
                    {exercise.rationale}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
