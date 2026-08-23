"use client";

import { useState, useEffect } from "react";
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

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeeklyWorkoutPlannerProps {
  userId: string;
}

interface Exercise {
  id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  equipment: string;
  target_sets: number;
  target_reps: number;
  suggested_weight_kg: number;
  rest_seconds: number;
  order_index: number;
  rationale: string;
}

interface PlanDay {
  id: string;
  day_index: number;
  workout_type: string;
  estimated_duration_minutes: number;
  focus_muscle_groups: string[];
  adherence_status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  exercises: Exercise[];
}

interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  created_at: string;
  updated_at: string;
  plan_days: PlanDay[];
  plan_metadata: {
    total_weekly_duration_minutes: number;
  };
}

interface PreviewExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  target_sets: number;
  target_reps: number;
  suggested_weight_kg: number;
  rest_seconds: number;
  rationale: string;
}

interface PreviewDay {
  date: string;
  workout_type: string;
  recommended_exercises: PreviewExercise[];
  plan_metadata: {
    total_exercises: number;
    estimated_duration_minutes: number;
    focus_areas: string[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Extract weekly split information from plan days
 * Looks at focus_areas in plan_metadata to find weekly_split: and day_X: patterns
 */
function extractWeeklySplit(planDays: (PlanDay | PreviewDay)[]): {
  splitName: string;
  schedule: Array<{ dayIndex: number; dayName: string; workout: string }>;
} | null {
  if (!planDays || planDays.length === 0) return null;

  // Get focus areas from first day (they should all have the same split info)
  const focusAreas = 'focus_muscle_groups' in planDays[0] 
    ? planDays[0].focus_muscle_groups 
    : planDays[0].plan_metadata.focus_areas;

  if (!focusAreas || focusAreas.length === 0) return null;

  // Find weekly_split info
  const splitInfo = focusAreas.find((area: string) => area.startsWith('weekly_split:'));
  if (!splitInfo) return null;

  const splitName = splitInfo.replace('weekly_split:', '').replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());

  // Extract day schedule from all days
  const schedule: Array<{ dayIndex: number; dayName: string; workout: string }> = [];
  
  planDays.forEach((day, index) => {
    const dayFocusAreas = 'focus_muscle_groups' in day 
      ? day.focus_muscle_groups 
      : day.plan_metadata.focus_areas;
    
    const dayInfo = dayFocusAreas.find((area: string) => area.startsWith(`day_${index}:`));
    if (dayInfo) {
      const workout = dayInfo.split(':')[1];
      schedule.push({
        dayIndex: index,
        dayName: DAY_NAMES[index],
        workout: workout === 'rest' ? 'Rest' : formatExerciseName(workout),
      });
    }
  });

  return schedule.length > 0 ? { splitName, schedule } : null;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

async function fetchWeeklyPreview(userId: string, weekStartDate: string): Promise<PreviewDay[]> {
  const preview: PreviewDay[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const res = await fetch(`${ML_SERVICE_URL}/workout/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, date: dateStr }),
      signal: AbortSignal.timeout(15_000),
    });
    
    if (!res.ok) {
      throw new Error(`Failed to load recommendation for ${dateStr}`);
    }
    
    const data = await res.json();
    preview.push({
      date: dateStr,
      workout_type: data.workout_type || 'Unknown',
      recommended_exercises: data.recommended_exercises || [],
      plan_metadata: data.plan_metadata || {
        total_exercises: 0,
        estimated_duration_minutes: 0,
        focus_areas: [],
      },
    });
  }
  
  return preview;
}

async function savePlan(userId: string, weekStartDate: string): Promise<WeeklyPlan> {
  const res = await fetch('/api/workout/weekly-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, week_start_date: weekStartDate }),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to save plan');
  }
  
  return res.json();
}

async function getSavedPlan(userId: string, weekStartDate?: string): Promise<WeeklyPlan | null> {
  const params = new URLSearchParams({ user_id: userId });
  if (weekStartDate) {
    params.append('week_start_date', weekStartDate);
  }
  
  const res = await fetch(`/api/workout/weekly-plan?${params}`);
  
  if (res.status === 404) {
    return null;
  }
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to load plan');
  }
  
  return res.json();
}

async function regenerateDay(planId: string, dayIndex: number): Promise<PlanDay> {
  const res = await fetch('/api/workout/weekly-plan/regenerate-day', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekly_plan_id: planId, day_index: dayIndex }),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to regenerate day');
  }
  
  return res.json();
}

async function updateAdherence(planDayId: string, status: PlanDay['adherence_status']): Promise<PlanDay> {
  const res = await fetch('/api/workout/weekly-plan/adherence', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_day_id: planDayId, adherence_status: status }),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update adherence');
  }
  
  return res.json();
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4"
        >
          <div className="h-5 w-2/5 rounded-full bg-[var(--color-surface-3)] mb-3" />
          <div className="h-4 w-full rounded-full bg-[var(--color-surface-3)] mb-2" />
          <div className="h-4 w-4/5 rounded-full bg-[var(--color-surface-3)]" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function WeeklyWorkoutPlanner({ userId }: WeeklyWorkoutPlannerProps) {
  const [savedPlan, setSavedPlan] = useState<WeeklyPlan | null>(null);
  const [previewPlan, setPreviewPlan] = useState<PreviewDay[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const weekStartDate = getMonday(new Date());

  // Load saved plan on mount
  useEffect(() => {
    if (userId && userId.trim()) {
      loadSavedPlan();
    } else {
      setIsLoading(false);
    }
  }, [userId]);

  const loadSavedPlan = async () => {
    if (!userId || !userId.trim()) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const plan = await getSavedPlan(userId, weekStartDate);
      setSavedPlan(plan);
    } catch (err) {
      // Don't show error for 404 (no plan found) - that's expected
      if (err instanceof Error && !err.message.includes('404') && !err.message.includes('not found')) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    setError(null);
    setPreviewPlan(null);
    try {
      const preview = await fetchWeeklyPreview(userId, weekStartDate);
      setPreviewPlan(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const plan = await savePlan(userId, weekStartDate);
      setSavedPlan(plan);
      setPreviewPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateDay = async (dayIndex: number) => {
    if (!savedPlan) return;
    
    setRegeneratingDay(dayIndex);
    setError(null);
    try {
      await regenerateDay(savedPlan.id, dayIndex);
      await loadSavedPlan(); // Reload to get updated day
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate day');
    } finally {
      setRegeneratingDay(null);
    }
  };

  const handleMarkComplete = async (planDayId: string) => {
    setError(null);
    try {
      await updateAdherence(planDayId, 'completed');
      await loadSavedPlan(); // Reload to show updated status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    }
  };

  const handleGenerateNewWeek = () => {
    setSavedPlan(null);
    handleGeneratePreview();
  };

  const handleDeletePlan = async () => {
    if (!savedPlan) return;
    
    try {
      const res = await fetch(`/api/workout/weekly-plan?plan_id=${savedPlan.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete plan');
      }
      
      setSavedPlan(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  };

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-body font-bold text-[17px] text-[var(--color-text-1)]">
            Weekly Workout Plan
          </h2>
          <p className="font-caption text-[12px] text-[var(--color-text-3)]">
            Week of {new Date(weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-[13px] font-body text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[10px] px-4 py-3">
          {error}
        </div>
      )}

      {/* No Plan State */}
      {!savedPlan && !previewPlan && (
        <div className="flex flex-col items-center gap-4 py-8">

          <p className="font-body text-[15px] text-[var(--color-text-2)] text-center max-w-md">
            Generate a personalized 7-day workout plan based on your goals and preferences
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={handleGeneratePreview}
            disabled={isGenerating}
            loading={isGenerating}
          >
            Generate Weekly Plan
          </Button>
        </div>
      )}

      {/* Weekly Split Accordion - For both Preview and Saved Plans */}
      {(previewPlan || savedPlan) && (() => {
        const days = savedPlan?.plan_days || previewPlan || [];
        const splitInfo = extractWeeklySplit(days);
        
        return (
          <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
            {/* Split Header */}
            {splitInfo && (
              <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <h3 className="font-body font-bold text-[15px] text-[var(--color-text-1)]">
                  Weekly Split: {splitInfo.splitName}
                </h3>
              </div>
            )}

            {/* Days Accordion */}
            <div className="divide-y divide-[var(--color-border)]">
              {days.map((day, index) => {
                const dayData = 'exercises' in day ? day : null;
                const previewData = 'recommended_exercises' in day ? day : null;
                const exercises = dayData?.exercises || previewData?.recommended_exercises || [];
                const workoutType = dayData?.workout_type || previewData?.workout_type || 'Rest';
                const duration = dayData?.estimated_duration_minutes || previewData?.plan_metadata.estimated_duration_minutes || 0;
                const focusAreas = dayData?.focus_muscle_groups || previewData?.plan_metadata.focus_areas.filter(a => !a.startsWith('day_') && !a.startsWith('weekly_split:') && a !== 'rest') || [];
                const adherenceStatus = dayData?.adherence_status;
                const isRest = exercises.length === 0;
                const isExpanded = expandedDay === index;
                const isRegenerating = regeneratingDay === index;

                return (
                  <div key={index}>
                    {/* Day Header - Clickable */}
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : index)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-surface-3)] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-body font-bold text-[14px] text-[var(--color-text-1)]">
                          {DAY_NAMES[index]}
                        </span>
                        {!isRest && (
                          <span className="font-caption text-[11px] text-[var(--color-text-3)]">
                            {workoutType === 'Unknown' || workoutType === 'Rest' 
                              ? (focusAreas.length > 0 ? formatExerciseName(focusAreas[0]) : 'Workout')
                              : workoutType}
                          </span>
                        )}
                        {isRest && (
                          <span className="font-caption text-[11px] text-[var(--color-text-3)]">
                            Rest
                          </span>
                        )}
                        {adherenceStatus === 'completed' && (
                          <span className="font-caption text-[10px] font-semibold text-[#22C55E] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full">Done</span>
                        )}
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path
                          d="M4 6l4 4 4-4"
                          stroke="var(--color-text-2)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {/* Expanded Day Content */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-[var(--color-surface)] space-y-3">
                        {/* Day Info */}
                        <div>
                          <h4 className="font-body font-bold text-[15px] text-[var(--color-text-1)] mb-1">
                            {DAY_NAMES[index]}
                          </h4>
                          <p className="font-caption text-[12px] text-[var(--color-text-3)]">
                            {workoutType} • {duration} min
                          </p>
                        </div>

                        {/* Muscle Group Badges */}
                        {focusAreas.length > 0 && !isRest && (
                          <div className="flex flex-wrap gap-2">
                            {focusAreas.map((area) => (
                              <span
                                key={area}
                                className={`inline-block rounded-full px-2 py-0.5 font-caption text-[10px] font-semibold uppercase tracking-wide ${getMuscleGroupColor(area)}`}
                              >
                                {formatExerciseName(area)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Rest Day Message */}
                        {isRest && (
                          <div className="text-center py-4">
                            <p className="font-body text-[13px] text-[var(--color-text-2)]">
                              Rest & Recovery
                            </p>
                          </div>
                        )}

                        {/* Exercises List */}
                        {!isRest && exercises.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {exercises.map((exercise, idx) => (
                              <div
                                key={idx}
                                className="text-[13px] font-body text-[var(--color-text-1)]"
                              >
                                • {formatExerciseName(exercise.exercise_name)} ({exercise.target_sets} × {exercise.target_reps})
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions for Saved Plans */}
                        {!previewPlan && dayData && (
                          <div className="flex flex-col gap-2 pt-2">
                            {!isRest && adherenceStatus !== 'completed' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleMarkComplete(dayData.id)}
                                  fullWidth
                                >
                                  Start Workout
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkComplete(dayData.id)}
                                  fullWidth
                                >
                                  Mark Complete
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRegenerateDay(index)}
                              disabled={isRegenerating}
                              loading={isRegenerating}
                            >
                              Regenerate
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions Footer */}
            <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
              {previewPlan && (
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSavePlan}
                    disabled={isSaving}
                    loading={isSaving}
                    fullWidth
                  >
                    Save This Plan
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleGeneratePreview}
                    disabled={isGenerating}
                    loading={isGenerating}
                  >
                    Regenerate
                  </Button>
                </div>
              )}

              {savedPlan && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleGenerateNewWeek}
                    fullWidth
                  >
                    Generate New Week
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleDeletePlan}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
