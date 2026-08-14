"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import GlowCard from "@/components/ui/GlowCard";
import { createClient } from "@/lib/supabase/client";
import { setupWorkoutRealtimeSubscription } from "@/lib/workout/realtime";
import type { LoggedSetRow, PlanExerciseRow, ExerciseRow } from "@/lib/types/workout";
import type { WorkoutRealtimeSubscription } from "@/lib/workout/realtime";

// Keyboard shortcuts
const KEYBOARD_SHORTCUTS = {
  LOG_SET: "Enter",
  CANCEL: "Escape",
  NEXT_INPUT: "Tab",
  NEXT_EXERCISE: "n",
  PREVIOUS_EXERCISE: "p",
  SKIP_REST: "s",
} as const;

interface SessionLoggerProps {
  workoutId: string;
  planId: string;
  userId: string;
  onComplete: () => void;
}

interface ExerciseWithDetails extends PlanExerciseRow {
  exercise: ExerciseRow;
}

interface SetInput {
  weight: string;
  reps: string;
  rpe: string;
}

export default function SessionLogger({
  workoutId,
  planId,
  userId,
  onComplete,
}: SessionLoggerProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Local state for current set inputs
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [setInput, setSetInput] = useState<SetInput>({
    weight: "",
    reps: "",
    rpe: "7",
  });
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time subscription ref
  const realtimeSubscriptionRef = useRef<WorkoutRealtimeSubscription | null>(null);
  
  // Refs for input elements (keyboard navigation)
  const weightInputRef = useRef<HTMLInputElement>(null);
  const repsInputRef = useRef<HTMLInputElement>(null);
  const rpeInputRef = useRef<HTMLInputElement>(null);
  const logSetButtonRef = useRef<HTMLButtonElement>(null);
  
  // ARIA live region for screen reader announcements
  const [announcement, setAnnouncement] = useState<string>("");

  // Fetch plan exercises with exercise details
  const { data: planExercises, isLoading: exercisesLoading } = useQuery({
    queryKey: ["plan-exercises", planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_exercises")
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq("plan_id", planId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as unknown as ExerciseWithDetails[];
    },
    enabled: Boolean(planId),
    staleTime: 60_000,
  });

  // Fetch logged sets for this workout
  const { data: loggedSets = [] } = useQuery<LoggedSetRow[]>({
    queryKey: ["workout-session-sets", workoutId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logged_sets")
        .select("*")
        .eq("workout_log_id", workoutId)
        .order("logged_at", { ascending: true });

      if (error) throw error;
      return data as unknown as LoggedSetRow[];
    },
    enabled: Boolean(workoutId),
    staleTime: 5_000,
  });

  // Real-time subscription for logged_sets updates using helper
  useEffect(() => {
    if (!workoutId || !userId) return;

    // Set up real-time subscription using the helper function
    const subscription = setupWorkoutRealtimeSubscription(supabase, {
      userId,
      workoutId,
      queryClient,
      onError: (error) => {
        console.error('[SessionLogger] Real-time subscription error:', error);
        setError('Real-time updates temporarily unavailable');
      },
      onReconnect: () => {
        console.log('[SessionLogger] Real-time subscription reconnected');
        setError(null);
      },
    });

    // Store subscription in ref
    realtimeSubscriptionRef.current = subscription;

    return () => {
      subscription.cleanup();
      realtimeSubscriptionRef.current = null;
    };
  }, [workoutId, userId, queryClient, supabase]);

  // Persist session state to localStorage
  useEffect(() => {
    if (!workoutId) return;
    
    const sessionState = {
      workoutId,
      currentExerciseIndex,
      currentSetNumber,
      setInput,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(`workout-session-${workoutId}`, JSON.stringify(sessionState));
  }, [workoutId, currentExerciseIndex, currentSetNumber, setInput]);

  // Restore session state on mount
  useEffect(() => {
    if (!workoutId) return;
    
    const savedState = localStorage.getItem(`workout-session-${workoutId}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Only restore if less than 4 hours old
        if (Date.now() - parsed.timestamp < 4 * 60 * 60 * 1000) {
          setCurrentExerciseIndex(parsed.currentExerciseIndex || 0);
          setCurrentSetNumber(parsed.currentSetNumber || 1);
          setSetInput(parsed.setInput || { weight: "", reps: "", rpe: "7" });
        }
      } catch {
        // Invalid state, ignore
      }
    }
  }, [workoutId]);

  // Rest timer countdown
  useEffect(() => {
    if (!isResting || restTimeRemaining <= 0) {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      if (restTimeRemaining === 0 && isResting) {
        setIsResting(false);
      }
      return;
    }

    restTimerRef.current = setInterval(() => {
      setRestTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
    };
  }, [isResting, restTimeRemaining]);

  // Log set mutation with optimistic updates
  const logSetMutation = useMutation({
    mutationFn: async (setData: {
      workout_id: string;
      exercise_id: string;
      set_number: number;
      weight_kg: number;
      reps: number;
      rpe?: number;
    }) => {
      const response = await fetch("/api/workout/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to log set");
      }

      return response.json() as Promise<LoggedSetRow>;
    },
    onMutate: async (newSet) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["workout-session-sets", workoutId] });

      // Snapshot previous value
      const previousSets = queryClient.getQueryData<LoggedSetRow[]>(["workout-session-sets", workoutId]);

      // Optimistically update to the new value
      const optimisticSet: LoggedSetRow = {
        id: `temp-${Date.now()}`,
        workout_log_id: newSet.workout_id,
        exercise_id: newSet.exercise_id,
        set_number: newSet.set_number,
        weight_kg: newSet.weight_kg,
        reps: newSet.reps,
        rpe: newSet.rpe || null,
        logged_at: new Date().toISOString(),
      };

      queryClient.setQueryData<LoggedSetRow[]>(
        ["workout-session-sets", workoutId],
        (old) => [...(old || []), optimisticSet]
      );

      return { previousSets };
    },
    onError: (err, newSet, context) => {
      // Rollback on error
      if (context?.previousSets) {
        queryClient.setQueryData(["workout-session-sets", workoutId], context.previousSets);
      }
      setError(err instanceof Error ? err.message : "Failed to log set");
    },
    onSuccess: (data) => {
      // Server reconciliation
      queryClient.setQueryData<LoggedSetRow[]>(
        ["workout-session-sets", workoutId],
        (old) => {
          if (!old) return [data];
          // Replace temp optimistic entry with real data
          return old.map((set) => 
            set.id.startsWith("temp-") && set.set_number === data.set_number 
              ? data 
              : set
          );
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-session-sets", workoutId] });
    },
  });

  // Handle logging a set
  const handleLogSet = useCallback(() => {
    if (!planExercises || !planExercises[currentExerciseIndex]) return;

    const currentExercise = planExercises[currentExerciseIndex];
    const weight = parseFloat(setInput.weight);
    const reps = parseInt(setInput.reps, 10);
    const rpe = parseFloat(setInput.rpe);

    // Validate inputs
    if (isNaN(weight) || weight < 0 || weight > 9999) {
      setError("Weight must be between 0 and 9999 kg");
      setAnnouncement("Error: Weight must be between 0 and 9999 kg");
      return;
    }

    if (isNaN(reps) || reps < 1 || reps > 999) {
      setError("Reps must be between 1 and 999");
      setAnnouncement("Error: Reps must be between 1 and 999");
      return;
    }

    if (isNaN(rpe) || rpe < 1 || rpe > 10) {
      setError("RPE must be between 1 and 10");
      setAnnouncement("Error: RPE must be between 1 and 10");
      return;
    }

    setError(null);

    // Log the set
    logSetMutation.mutate({
      workout_id: workoutId,
      exercise_id: currentExercise.exercise_id,
      set_number: currentSetNumber,
      weight_kg: weight,
      reps: reps,
      rpe: rpe,
    });

    // Announce set completion to screen readers
    setAnnouncement(
      `Set ${currentSetNumber} logged: ${weight} kilograms for ${reps} repetitions at RPE ${rpe}`
    );

    // Start rest timer
    if (currentExercise.rest_seconds > 0) {
      setRestTimeRemaining(currentExercise.rest_seconds);
      setIsResting(true);
      setAnnouncement(
        `Rest timer started: ${Math.floor(currentExercise.rest_seconds / 60)} minutes ${currentExercise.rest_seconds % 60} seconds`
      );
    }

    // Increment set number
    setCurrentSetNumber((prev) => prev + 1);

    // Reset input fields but keep weight for convenience
    setSetInput((prev) => ({
      weight: prev.weight, // Keep weight
      reps: "",
      rpe: "7",
    }));

    // Focus on reps input for next set
    setTimeout(() => {
      repsInputRef.current?.focus();
    }, 100);
  }, [
    planExercises,
    currentExerciseIndex,
    setInput,
    currentSetNumber,
    workoutId,
    logSetMutation,
  ]);

  // Handle moving to next exercise
  const handleNextExercise = useCallback(() => {
    if (!planExercises) return;
    
    if (currentExerciseIndex < planExercises.length - 1) {
      const nextExercise = planExercises[currentExerciseIndex + 1];
      setCurrentExerciseIndex((prev) => prev + 1);
      setCurrentSetNumber(1);
      setSetInput({ weight: "", reps: "", rpe: "7" });
      setIsResting(false);
      setRestTimeRemaining(0);
      setAnnouncement(
        `Moved to exercise ${currentExerciseIndex + 2}: ${nextExercise.exercise.name.replace(/_/g, " ")}`
      );
      
      // Focus on weight input for new exercise
      setTimeout(() => {
        weightInputRef.current?.focus();
      }, 100);
    }
  }, [planExercises, currentExerciseIndex]);

  // Handle moving to previous exercise
  const handlePreviousExercise = useCallback(() => {
    if (currentExerciseIndex > 0) {
      const prevExercise = planExercises?.[currentExerciseIndex - 1];
      setCurrentExerciseIndex((prev) => prev - 1);
      setCurrentSetNumber(1);
      setSetInput({ weight: "", reps: "", rpe: "7" });
      setIsResting(false);
      setRestTimeRemaining(0);
      if (prevExercise) {
        setAnnouncement(
          `Moved to exercise ${currentExerciseIndex}: ${prevExercise.exercise.name.replace(/_/g, " ")}`
        );
      }
      
      // Focus on weight input
      setTimeout(() => {
        weightInputRef.current?.focus();
      }, 100);
    }
  }, [currentExerciseIndex, planExercises]);

  // Handle completing the workout
  const handleCompleteWorkout = useCallback(async () => {
    try {
      const response = await fetch(`/api/workout/session/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete workout");
      }

      // Clear localStorage
      localStorage.removeItem(`workout-session-${workoutId}`);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["workout-session"] });
      queryClient.invalidateQueries({ queryKey: ["workout-history"] });

      setAnnouncement("Workout completed successfully!");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete workout");
      setAnnouncement("Error: Failed to complete workout");
    }
  }, [workoutId, queryClient, onComplete]);

  // Handle canceling input (Escape key)
  const handleCancel = useCallback(() => {
    setSetInput({ weight: "", reps: "", rpe: "7" });
    setError(null);
    setAnnouncement("Input cleared");
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = event.target as HTMLElement;
      const isInputFocused = target.tagName === "INPUT";

      // Enter key: Log set (only when input is focused and valid)
      if (event.key === KEYBOARD_SHORTCUTS.LOG_SET && isInputFocused) {
        event.preventDefault();
        if (setInput.weight && setInput.reps) {
          handleLogSet();
        }
      }

      // Escape key: Cancel/clear input
      if (event.key === KEYBOARD_SHORTCUTS.CANCEL) {
        event.preventDefault();
        handleCancel();
      }

      // Global shortcuts (only when not typing in an input)
      if (!isInputFocused) {
        // 'n' key: Next exercise
        if (event.key === KEYBOARD_SHORTCUTS.NEXT_EXERCISE) {
          event.preventDefault();
          if (currentExerciseIndex < (planExercises?.length || 0) - 1) {
            handleNextExercise();
          }
        }

        // 'p' key: Previous exercise
        if (event.key === KEYBOARD_SHORTCUTS.PREVIOUS_EXERCISE) {
          event.preventDefault();
          if (currentExerciseIndex > 0) {
            handlePreviousExercise();
          }
        }

        // 's' key: Skip rest timer
        if (event.key === KEYBOARD_SHORTCUTS.SKIP_REST && isResting) {
          event.preventDefault();
          setIsResting(false);
          setRestTimeRemaining(0);
          setAnnouncement("Rest timer skipped");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setInput, handleLogSet, handleCancel, handleNextExercise, handlePreviousExercise, currentExerciseIndex, planExercises, isResting]);

  // Format rest timer display
  const formatRestTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading state
  if (exercisesLoading) {
    return (
      <div className="flex flex-col gap-4 w-full animate-pulse">
        <div className="h-32 bg-[var(--color-surface-2)] rounded-[18px]" />
        <div className="h-64 bg-[var(--color-surface-2)] rounded-[18px]" />
      </div>
    );
  }

  if (!planExercises || planExercises.length === 0) {
    return (
      <div className="p-6 text-center text-[var(--color-text-2)]">
        No exercises found in this plan.
      </div>
    );
  }

  const currentExercise = planExercises[currentExerciseIndex];
  const currentExerciseSets = loggedSets.filter(
    (set) => set.exercise_id === currentExercise.exercise_id
  );

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* ARIA Live Region for Screen Reader Announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* Exercise Progress Header */}
      <GlowCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">
            Exercise {currentExerciseIndex + 1} of {planExercises.length}
          </span>
          <span className="font-caption text-[11px] text-[var(--color-text-3)]">
            {currentExercise.exercise.muscle_group}
          </span>
        </div>
        <h2 className="font-body font-bold text-[18px] text-[var(--color-text-1)] mb-1 capitalize">
          {currentExercise.exercise.name.replace(/_/g, " ")}
        </h2>
        <p className="font-body text-[13px] text-[var(--color-text-2)]">
          Target: {currentExercise.target_sets} sets × {currentExercise.target_reps} reps
        </p>
      </GlowCard>

      {/* Rest Timer (shown when resting) */}
      <AnimatePresence>
        {isResting && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            role="timer"
            aria-live="polite"
            aria-atomic="true"
          >
            <GlowCard className="p-6 text-center" glowColor="34,197,94">
              <div className="flex flex-col items-center gap-2">
                <span className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">
                  Rest Time
                </span>
                <span 
                  className="font-body font-bold text-[36px] text-[#22C55E]"
                  aria-label={`${Math.floor(restTimeRemaining / 60)} minutes and ${restTimeRemaining % 60} seconds remaining`}
                >
                  {formatRestTime(restTimeRemaining)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsResting(false);
                    setRestTimeRemaining(0);
                    setAnnouncement("Rest timer skipped");
                  }}
                  aria-label="Skip rest timer and continue to next set"
                >
                  Skip Rest
                </Button>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Set Input Form */}
      <GlowCard className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-body font-bold text-[15px] text-[var(--color-text-1)]">
              Log Set {currentSetNumber}
            </h3>
            <div className="flex items-center gap-2">
              <span className="font-caption text-[11px] text-[var(--color-text-3)]">
                {currentExerciseSets.length} sets completed
              </span>
              <span className="inline-flex items-center gap-1 font-caption text-[10px] text-[var(--color-text-3)] bg-[var(--color-surface-2)] px-2 py-1 rounded-md border border-[var(--color-border)]">
                <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1 py-0.5 rounded border border-[var(--color-border)]">Enter</kbd>
                <span>to log</span>
                <span className="mx-0.5">·</span>
                <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1 py-0.5 rounded border border-[var(--color-border)]">Esc</kbd>
                <span>to clear</span>
              </span>
            </div>
          </div>

          {/* Input Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Weight Input */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="weight-input"
                className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide"
              >
                Weight (kg)
              </label>
              <input
                ref={weightInputRef}
                id="weight-input"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                max="9999"
                value={setInput.weight}
                onChange={(e) => setSetInput((prev) => ({ ...prev, weight: e.target.value }))}
                placeholder="0"
                aria-label="Weight in kilograms"
                aria-describedby="weight-help"
                aria-invalid={error?.includes("Weight") ? "true" : "false"}
                className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] transition-shadow"
              />
              <span id="weight-help" className="sr-only">
                Enter weight between 0 and 9999 kilograms
              </span>
            </div>

            {/* Reps Input */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="reps-input"
                className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide"
              >
                Reps
              </label>
              <input
                ref={repsInputRef}
                id="reps-input"
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                value={setInput.reps}
                onChange={(e) => setSetInput((prev) => ({ ...prev, reps: e.target.value }))}
                placeholder="0"
                aria-label="Number of repetitions"
                aria-describedby="reps-help"
                aria-invalid={error?.includes("Reps") ? "true" : "false"}
                className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] transition-shadow"
              />
              <span id="reps-help" className="sr-only">
                Enter repetitions between 1 and 999
              </span>
            </div>

            {/* RPE Input */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="rpe-input"
                className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide"
              >
                RPE (1-10)
              </label>
              <input
                ref={rpeInputRef}
                id="rpe-input"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="1"
                max="10"
                value={setInput.rpe}
                onChange={(e) => setSetInput((prev) => ({ ...prev, rpe: e.target.value }))}
                aria-label="Rate of Perceived Exertion from 1 to 10"
                aria-describedby="rpe-help"
                aria-invalid={error?.includes("RPE") ? "true" : "false"}
                className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] transition-shadow"
              />
              <span id="rpe-help" className="sr-only">
                Enter Rate of Perceived Exertion between 1 and 10
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[13px] font-body text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[10px] px-4 py-3"
              role="alert"
            >
              {error}
            </motion.div>
          )}

          {/* Log Set Button */}
          <Button
            ref={logSetButtonRef}
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleLogSet}
            disabled={!setInput.weight || !setInput.reps || logSetMutation.isPending}
            loading={logSetMutation.isPending}
            aria-label="Log set with entered weight and repetitions"
            aria-describedby="keyboard-shortcut-hint"
          >
            Log Set
          </Button>
          <span id="keyboard-shortcut-hint" className="sr-only">
            Press Enter to log set, press Escape to clear inputs
          </span>
        </div>
      </GlowCard>

      {/* Completed Sets for Current Exercise */}
      {currentExerciseSets.length > 0 && (
        <GlowCard className="p-6">
          <h3 className="font-body font-bold text-[15px] text-[var(--color-text-1)] mb-3">
            Completed Sets
          </h3>
          <div 
            className="flex flex-col gap-2"
            role="list"
            aria-label="Completed sets for current exercise"
          >
            {currentExerciseSets.map((set, index) => (
              <motion.div
                key={set.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-[10px] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                role="listitem"
                aria-label={`Set ${set.set_number}: ${set.weight_kg} kilograms for ${set.reps} repetitions${set.rpe ? ` at RPE ${set.rpe}` : ""}`}
              >
                <span className="font-body text-[13px] text-[var(--color-text-2)]">
                  Set {set.set_number}
                </span>
                <div className="flex items-center gap-4">
                  <span className="font-body font-bold text-[13px] text-[var(--color-text-1)]">
                    {set.weight_kg}kg × {set.reps}
                  </span>
                  {set.rpe && (
                    <span className="font-body text-[13px] text-[var(--color-text-3)]">
                      RPE {set.rpe}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </GlowCard>
      )}

      {/* Exercise Navigation */}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePreviousExercise}
          disabled={currentExerciseIndex === 0}
          className="flex-1"
          aria-label={`Go to previous exercise${currentExerciseIndex > 0 && planExercises ? `: ${planExercises[currentExerciseIndex - 1].exercise.name.replace(/_/g, " ")}` : ""}`}
        >
          ← Previous
        </Button>
        {currentExerciseIndex < planExercises.length - 1 ? (
          <Button
            variant="ghost"
            size="lg"
            onClick={handleNextExercise}
            className="flex-1"
            aria-label={`Go to next exercise: ${planExercises[currentExerciseIndex + 1].exercise.name.replace(/_/g, " ")}`}
          >
            Next →
          </Button>
        ) : (
          <Button
            variant="success"
            size="lg"
            onClick={handleCompleteWorkout}
            className="flex-1"
            aria-label="Complete workout and save session"
          >
            Complete Workout
          </Button>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div 
        className="p-4 rounded-[12px] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
        role="region"
        aria-label="Keyboard shortcuts"
      >
        <h4 className="font-caption text-[10px] text-[var(--color-text-3)] uppercase tracking-wide mb-2">
          Keyboard Shortcuts
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)] min-w-[24px] text-center">Enter</kbd>
            <span className="text-[var(--color-text-3)]">Log set</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)] min-w-[24px] text-center">Esc</kbd>
            <span className="text-[var(--color-text-3)]">Clear inputs</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)] min-w-[24px] text-center">N</kbd>
            <span className="text-[var(--color-text-3)]">Next exercise</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)] min-w-[24px] text-center">P</kbd>
            <span className="text-[var(--color-text-3)]">Previous exercise</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)] min-w-[24px] text-center">S</kbd>
            <span className="text-[var(--color-text-3)]">Skip rest timer</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="font-mono text-[var(--color-text-2)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)] min-w-[24px] text-center">Tab</kbd>
            <span className="text-[var(--color-text-3)]">Navigate inputs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
