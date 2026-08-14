"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import GlowCard from "@/components/ui/GlowCard";
import { createClient } from "@/lib/supabase/client";

interface ManualWorkoutLoggerProps {
  userId: string;
  date: string;
}

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  exercise_type: string;
}

interface LoggedSet {
  id: string;
  exercise_id: string;
  exercise_name?: string;
  exercise_type?: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_minutes: number | null;
  rpe: number | null;
  logged_at: string;
}

interface SetInput {
  sets: string;
  weight: string;
  reps: string;
  duration: string; // For cardio exercises (in minutes)
}

export default function ManualWorkoutLogger({ userId, date }: ManualWorkoutLoggerProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [setInput, setSetInput] = useState<SetInput>({
    sets: "",
    weight: "",
    reps: "",
    duration: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);

  // Fetch user's body weight from profile
  const { data: userProfile } = useQuery({
    queryKey: ["nutrition-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nutrition_profiles")
        .select("weight_kg")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      return data as { weight_kg: number | null };
    },
    enabled: Boolean(userId),
    staleTime: 300_000, // Cache for 5 minutes
  });

  // Search exercises
  const { data: exercises = [], isLoading: searchLoading } = useQuery({
    queryKey: ["exercise-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      // Check if search query matches a category (muscle group or exercise type)
      const lowerQuery = searchQuery.toLowerCase();
      const muscleGroups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body'];
      const exerciseTypes = ['cardio', 'strength'];
      
      let query = supabase
        .from("exercises")
        .select("id, name, muscle_group, equipment, exercise_type");

      // Check if it's a category search
      if (muscleGroups.includes(lowerQuery)) {
        // Search by muscle group
        query = query.eq('muscle_group', lowerQuery);
      } else if (exerciseTypes.includes(lowerQuery)) {
        // Search by exercise type
        query = query.eq('exercise_type', lowerQuery);
      } else {
        // Search by name or partial muscle group match
        query = query.or(`name.ilike.%${searchQuery}%,muscle_group.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      return data as Exercise[];
    },
    enabled: searchQuery.length >= 2,
    staleTime: 60_000,
  });

  // Fetch today's logged sets
  const { data: todaySets = [] } = useQuery<LoggedSet[]>({
    queryKey: ["today-workout-sets", userId, date],
    queryFn: async () => {
      // First get today's workout log
      const { data: logs, error: logsError } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .single();

      if (logsError || !logs) return [];

      // Get all sets for today's workout
      const { data: sets, error: setsError } = await supabase
        .from("logged_sets")
        .select(`
          id,
          exercise_id,
          set_number,
          weight_kg,
          reps,
          duration_minutes,
          rpe,
          logged_at,
          exercises!inner(name, exercise_type)
        `)
        .eq("workout_log_id", logs.id)
        .order("logged_at", { ascending: false });

      if (setsError) throw setsError;

      return (sets || []).map((set: any) => ({
        id: set.id,
        exercise_id: set.exercise_id,
        exercise_name: set.exercises?.name || "Unknown",
        exercise_type: set.exercises?.exercise_type || "strength",
        set_number: set.set_number,
        weight_kg: set.weight_kg,
        reps: set.reps,
        duration_minutes: set.duration_minutes,
        rpe: set.rpe,
        logged_at: set.logged_at,
      }));
    },
    enabled: Boolean(userId && date),
    staleTime: 5_000,
  });

  // Get or create workout log for today
  const getOrCreateWorkoutLog = async (): Promise<string> => {
    console.log('[ManualWorkoutLogger] Getting or creating workout log for:', { userId, date, workoutLogId });
    
    if (workoutLogId) return workoutLogId;

    // Check if workout log exists for today
    const { data: existingLog } = await supabase
      .from("workout_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("date", date)
      .single();

    if (existingLog) {
      console.log('[ManualWorkoutLogger] Found existing log:', existingLog.id);
      setWorkoutLogId(existingLog.id as string);
      return existingLog.id as string;
    }

    // Create new workout log
    console.log('[ManualWorkoutLogger] Creating new workout log');
    const { data: newLog, error } = await supabase
      .from("workout_logs")
      .insert({
        user_id: userId,
        plan_id: null, // Manual workout, no plan
        date: date,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error('[ManualWorkoutLogger] Error creating workout log:', error);
      throw error;
    }
    
    console.log('[ManualWorkoutLogger] Created new workout log:', newLog.id);
    setWorkoutLogId(newLog.id as string);
    return newLog.id as string;
  };

  // Log set mutation
  const logSetMutation = useMutation({
    mutationFn: async (setData: {
      workout_log_id: string;
      exercise_id: string;
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      duration_minutes: number | null;
      rpe: number | null;
    }) => {
      const { data, error } = await supabase
        .from("logged_sets")
        .insert(setData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-workout-sets", userId, date] });
      queryClient.invalidateQueries({ queryKey: ["workout-history", userId] });
      
      // Clear inputs and reset to exercise search
      setSetInput({ sets: "", weight: "", reps: "", duration: "" });
      setSelectedExercise(null); // Reset to search for another exercise
      setSearchQuery(""); // Clear search query
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to log set");
    },
  });

  // Delete set mutation
  const deleteSetMutation = useMutation({
    mutationFn: async (setId: string) => {
      const { error } = await supabase
        .from("logged_sets")
        .delete()
        .eq("id", setId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-workout-sets", userId, date] });
      queryClient.invalidateQueries({ queryKey: ["workout-history", userId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete set");
    },
  });

  // Handle logging sets
  const handleLogSet = useCallback(async () => {
    if (!selectedExercise) {
      setError("Please select an exercise first");
      return;
    }

    const isCardio = selectedExercise.exercise_type === 'cardio';
    const sets = parseInt(setInput.sets, 10);

    // Validate inputs based on exercise type
    if (isNaN(sets) || sets < 1 || sets > 99) {
      setError("Sets must be between 1 and 99");
      return;
    }

    if (isCardio) {
      // Cardio validation: duration required
      const duration = parseFloat(setInput.duration);
      
      if (isNaN(duration) || duration <= 0 || duration > 999) {
        setError("Duration must be between 0 and 999 minutes");
        return;
      }

      try {
        const logId = await getOrCreateWorkoutLog();

        // Calculate starting set number for this exercise
        const exerciseSets = todaySets.filter(
          (s) => s.exercise_id === selectedExercise.id
        );
        const startingSetNumber = exerciseSets.length + 1;

        // Log multiple cardio sessions
        for (let i = 0; i < sets; i++) {
          await new Promise<void>((resolve, reject) => {
            logSetMutation.mutate(
              {
                workout_log_id: logId,
                exercise_id: selectedExercise.id,
                set_number: startingSetNumber + i,
                weight_kg: null,
                reps: null,
                duration_minutes: duration,
                rpe: null,
              },
              {
                onSuccess: () => resolve(),
                onError: (err) => reject(err),
              }
            );
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log cardio sessions");
      }
    } else {
      // Strength validation: weight and reps required
      const weight = parseFloat(setInput.weight);
      const reps = parseInt(setInput.reps, 10);

      if (isNaN(weight) || weight < 0 || weight > 9999) {
        setError("Weight must be between 0 and 9999 kg");
        return;
      }

      if (isNaN(reps) || reps < 1 || reps > 999) {
        setError("Reps must be between 1 and 999");
        return;
      }

      try {
        const logId = await getOrCreateWorkoutLog();

        // Calculate starting set number for this exercise
        const exerciseSets = todaySets.filter(
          (s) => s.exercise_id === selectedExercise.id
        );
        const startingSetNumber = exerciseSets.length + 1;

        // Log multiple sets
        for (let i = 0; i < sets; i++) {
          await new Promise<void>((resolve, reject) => {
            logSetMutation.mutate(
              {
                workout_log_id: logId,
                exercise_id: selectedExercise.id,
                set_number: startingSetNumber + i,
                weight_kg: weight,
                reps: reps,
                duration_minutes: null,
                rpe: null,
              },
              {
                onSuccess: () => resolve(),
                onError: (err) => reject(err),
              }
            );
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log sets");
      }
    }
  }, [selectedExercise, setInput, todaySets, userId, date, workoutLogId, logSetMutation]);

  // Handle exercise selection
  const handleSelectExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setSearchQuery("");
    setError(null);

    const isCardio = exercise.exercise_type === 'cardio';
    const isBodyweight = exercise.equipment.toLowerCase() === "bodyweight";
    
    if (isCardio) {
      // Cardio exercise: clear weight/reps, keep duration
      setSetInput((prev) => ({ 
        ...prev, 
        weight: "", 
        reps: "",
        duration: prev.duration || "" 
      }));
    } else if (isBodyweight && userProfile?.weight_kg) {
      // Bodyweight strength exercise: auto-fill weight
      setSetInput((prev) => ({ 
        ...prev, 
        weight: userProfile.weight_kg.toString(),
        duration: ""
      }));
    } else {
      // Regular strength exercise: clear weight and duration
      setSetInput((prev) => ({ 
        ...prev, 
        weight: "",
        duration: ""
      }));
    }
  };

  // Format exercise name
  const formatExerciseName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
  };

  // Group sets by exercise
  const setsByExercise = todaySets.reduce((acc, set) => {
    if (!acc[set.exercise_id]) {
      acc[set.exercise_id] = {
        name: set.exercise_name || "Unknown",
        sets: [],
      };
    }
    acc[set.exercise_id].sets.push(set);
    return acc;
  }, {} as Record<string, { name: string; sets: LoggedSet[] }>);

  return (
    <div className="flex flex-col gap-4">
      {/* Exercise Search/Selection */}
      <GlowCard className="p-5">
        <h3 className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-3">
          SELECT EXERCISE
        </h3>

        {!selectedExercise ? (
          <div className="flex flex-col gap-3">
            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises or categories (e.g., chest, cardio, bench press)"
              className="h-12 px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[14px] text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-shadow"
              autoFocus
            />

            {/* Search Results */}
            {searchLoading && (
              <div className="text-center py-4 text-[var(--color-text-3)] font-body text-[13px]">
                Searching...
              </div>
            )}

            {searchQuery.length >= 2 && !searchLoading && exercises.length === 0 && (
              <div className="text-center py-4 text-[var(--color-text-3)] font-body text-[13px]">
                No exercises found. Try a different search term.
              </div>
            )}

            {exercises.length > 0 && (
              <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
                {exercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => handleSelectExercise(exercise)}
                    className="w-full py-3 px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:border-[#2563EB]/40 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <p className="font-body font-semibold text-[15px] text-[var(--color-text-1)]">
                          {formatExerciseName(exercise.name)}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#DBEAFE] dark:bg-[#1E3A8A] font-caption text-[10px] font-semibold text-[#1E40AF] dark:text-[#93C5FD] uppercase tracking-wider">
                          {exercise.muscle_group}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-[#374151] font-caption text-[10px] font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                          {exercise.equipment.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        className="shrink-0 text-[#9CA3AF] group-hover:text-[#2563EB] transition-colors"
                      >
                        <path
                          d="M7 15l5-5-5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full py-3 px-4 rounded-[12px] border-2 border-[#2563EB] bg-[#EFF6FF] dark:bg-[#1E3A8A]/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <p className="font-body font-bold text-[15px] text-[var(--color-text-1)]">
                  {formatExerciseName(selectedExercise.name)}
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#DBEAFE] dark:bg-[#1E3A8A] font-caption text-[10px] font-semibold text-[#1E40AF] dark:text-[#93C5FD] uppercase tracking-wider">
                  {selectedExercise.muscle_group}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-[#374151] font-caption text-[10px] font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                  {selectedExercise.equipment.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                onClick={() => setSelectedExercise(null)}
                className="font-body text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] underline underline-offset-2 transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          </div>
        )}
      </GlowCard>

      {/* Log Set Form */}
      {selectedExercise && (
        <GlowCard className="p-5">
          <h3 className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-3">
            LOG EXERCISE
          </h3>

          <div className="flex flex-col gap-4">
            {/* Input Grid - Different for cardio vs strength */}
            {selectedExercise.exercise_type === 'cardio' ? (
              // Cardio: Sets + Duration
              <div className="grid grid-cols-2 gap-3">
                {/* Sets */}
                <div className="flex flex-col gap-2">
                  <label className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">
                    Sessions
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="99"
                    value={setInput.sets}
                    onChange={(e) =>
                      setSetInput((prev) => ({ ...prev, sets: e.target.value }))
                    }
                    placeholder="0"
                    className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-shadow"
                  />
                </div>

                {/* Duration */}
                <div className="flex flex-col gap-2">
                  <label className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="999"
                    value={setInput.duration}
                    onChange={(e) =>
                      setSetInput((prev) => ({ ...prev, duration: e.target.value }))
                    }
                    placeholder="0"
                    className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-shadow"
                  />
                </div>
              </div>
            ) : (
              // Strength: Sets + Weight + Reps
              <div className="grid grid-cols-3 gap-3">
                {/* Sets */}
                <div className="flex flex-col gap-2">
                  <label className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">
                    Sets
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="99"
                    value={setInput.sets}
                    onChange={(e) =>
                      setSetInput((prev) => ({ ...prev, sets: e.target.value }))
                    }
                    placeholder="0"
                    className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-shadow"
                  />
                </div>

                {/* Weight */}
                <div className="flex flex-col gap-2">
                  <label className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="9999"
                    value={setInput.weight}
                    onChange={(e) =>
                      setSetInput((prev) => ({ ...prev, weight: e.target.value }))
                    }
                    placeholder="0"
                    className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-shadow"
                  />
                </div>

                {/* Reps */}
                <div className="flex flex-col gap-2">
                  <label className="font-caption text-[11px] text-[var(--color-text-3)] uppercase tracking-wide">
                    Reps
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="999"
                    value={setInput.reps}
                    onChange={(e) =>
                      setSetInput((prev) => ({ ...prev, reps: e.target.value }))
                    }
                    placeholder="0"
                    className="h-12 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] font-bold text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-shadow"
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[13px] font-body text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3"
              >
                {error}
              </motion.div>
            )}

            {/* Log Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleLogSet}
              disabled={
                !setInput.sets || 
                (selectedExercise.exercise_type === 'cardio' 
                  ? !setInput.duration 
                  : (!setInput.weight || !setInput.reps)) ||
                logSetMutation.isPending
              }
              loading={logSetMutation.isPending}
            >
              Log {selectedExercise.exercise_type === 'cardio' ? 'Sessions' : 'Sets'}
            </Button>
          </div>
        </GlowCard>
      )}

      {/* Today's Logged Sets */}
      {todaySets.length > 0 && (
        <GlowCard className="p-5">
          <h3 className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-3">
            TODAY'S WORKOUT
          </h3>

          <div className="flex flex-col gap-4">
            {Object.entries(setsByExercise).map(([exerciseId, { name, sets }]) => (
              <div key={exerciseId}>
                <p className="font-body font-semibold text-[13px] text-[var(--color-text-1)] mb-2">
                  {formatExerciseName(name)}
                </p>
                <div className="flex flex-col gap-2">
                  {sets.map((set) => (
                    <div
                      key={set.id}
                      className="flex items-center justify-between p-3 rounded-[10px] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                    >
                      <span className="font-body text-[13px] text-[var(--color-text-2)]">
                        {set.exercise_type === 'cardio' ? 'Session' : 'Set'} {set.set_number}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="font-body font-bold text-[13px] text-[var(--color-text-1)]">
                          {set.exercise_type === 'cardio' 
                            ? `${set.duration_minutes} min`
                            : `${set.weight_kg}kg × ${set.reps}`
                          }
                        </span>
                        <button
                          onClick={() => deleteSetMutation.mutate(set.id)}
                          disabled={deleteSetMutation.isPending}
                          className="ml-2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--color-text-3)] hover:text-red-500 transition-colors disabled:opacity-50"
                          aria-label={`Delete ${set.exercise_type === 'cardio' ? 'session' : 'set'} ${set.set_number}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      )}
    </div>
  );
}
