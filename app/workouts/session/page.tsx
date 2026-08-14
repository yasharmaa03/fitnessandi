"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store/user";
import Link from "next/link";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  order: number;
}

interface LoggedSet {
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  timestamp: string;
}

export default function WorkoutSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const userEmail = useUserStore((s) => s.email);

  // Workout state
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("Workout Session");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  
  // Input state
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load workout data
  useEffect(() => {
    async function loadWorkout() {
      try {
        const planIdParam = searchParams.get("planId");
        const workoutIdParam = searchParams.get("workoutId");

        if (!planIdParam || !userEmail) {
          router.push("/workouts");
          return;
        }

        // Get plan details
        const { data: planData, error: planError } = await supabase
          .from("workout_plans")
          .select(`
            name,
            plan_exercises (
              exercise_id,
              target_sets,
              target_reps,
              rest_seconds,
              order_index,
              exercises (id, name)
            )
          `)
          .eq("id", planIdParam)
          .single();

        if (planError) throw planError;

        if (planData) {
          setPlanName(planData.name);
          const exs = planData.plan_exercises
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((pe: any) => ({
              id: pe.exercises.id,
              name: pe.exercises.name,
              sets: pe.target_sets,
              reps: pe.target_reps,
              rest_seconds: pe.rest_seconds,
              order: pe.order_index,
            }));
          setExercises(exs);
          
          // Set initial weight/reps
          if (exs.length > 0) {
            setReps(exs[0].reps);
          }
        }

        // Use existing workout or create a new one
        if (workoutIdParam) {
          setWorkoutId(workoutIdParam);
        } else {
          // Create new workout session
          const { data: newWorkout, error: workoutError } = await supabase
            .from("workout_logs")
            .insert({
              user_id: userEmail,
              plan_id: planIdParam,
              date: new Date().toISOString().split("T")[0],
              status: "in_progress",
            })
            .select()
            .single();

          if (workoutError) throw workoutError;
          setWorkoutId(newWorkout.id);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading workout:", error);
        router.push("/workouts");
      }
    }

    loadWorkout();
  }, [searchParams, userEmail, router, supabase]);

  // Rest timer
  useEffect(() => {
    if (!isResting || restTimeLeft <= 0) return;

    const timer = setTimeout(() => {
      setRestTimeLeft(restTimeLeft - 1);
      if (restTimeLeft === 1) {
        setIsResting(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isResting, restTimeLeft]);

  // Log a set
  const logSet = async () => {
    if (!workoutId || exercises.length === 0) return;

    const currentExercise = exercises[currentExerciseIdx];

    try {
      // Save to database
      await supabase.from("logged_sets").insert({
        workout_log_id: workoutId,
        exercise_id: currentExercise.id,
        set_number: currentSetNumber,
        weight_kg: weight,
        reps: reps,
        rpe: 7, // Default RPE
      });

      // Add to local state
      const newSet: LoggedSet = {
        exercise_id: currentExercise.id,
        set_number: currentSetNumber,
        weight,
        reps,
        timestamp: new Date().toISOString(),
      };
      setLoggedSets([...loggedSets, newSet]);

      // Start rest timer
      if (currentExercise.rest_seconds > 0) {
        setRestTimeLeft(currentExercise.rest_seconds);
        setIsResting(true);
      }

      // Move to next set
      setCurrentSetNumber(currentSetNumber + 1);
    } catch (error) {
      console.error("Error logging set:", error);
    }
  };

  // Move to next exercise
  const nextExercise = () => {
    if (currentExerciseIdx < exercises.length - 1) {
      setCurrentExerciseIdx(currentExerciseIdx + 1);
      setCurrentSetNumber(1);
      setWeight(0);
      setReps(exercises[currentExerciseIdx + 1].reps);
      setIsResting(false);
      setLoggedSets([]);
    }
  };

  // Complete workout
  const completeWorkout = async () => {
    if (!workoutId) return;

    try {
      await supabase
        .from("workout_logs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", workoutId);

      setIsCompleted(true);
    } catch (error) {
      console.error("Error completing workout:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <p className="text-[var(--color-text-2)]">Loading workout...</p>
      </div>
    );
  }

  if (isCompleted) {
    const totalSets = loggedSets.length;
    const totalVolume = loggedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-20 h-20 rounded-full bg-[#22C55E] flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M6 18l8 8 16-16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="text-center">
          <h1 className="font-heading text-[2rem] text-[var(--color-text-1)] tracking-wide">
            WORKOUT COMPLETE!
          </h1>
          <p className="font-caption text-[11px] font-light text-[var(--color-text-3)] mt-1">
            {planName}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          <div className="bg-[var(--color-surface-2)] rounded-[12px] p-4 text-center border border-[var(--color-border)]">
            <p className="font-metric text-[1.375rem] text-[var(--color-text-1)]">{totalSets}</p>
            <p className="font-caption text-[10px] font-light text-[var(--color-text-3)]">Total Sets</p>
          </div>
          <div className="bg-[var(--color-surface-2)] rounded-[12px] p-4 text-center border border-[var(--color-border)]">
            <p className="font-metric text-[1.375rem] text-[var(--color-text-1)]">{totalVolume.toFixed(0)}kg</p>
            <p className="font-caption text-[10px] font-light text-[var(--color-text-3)]">Volume</p>
          </div>
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <Link 
            href="/workouts" 
            className="flex-1 h-12 rounded-[12px] border border-[var(--color-border)] text-[var(--color-text-1)] font-body font-bold text-[13px] flex items-center justify-center"
          >
            Done
          </Link>
        </div>
      </div>
    );
  }

  const currentExercise = exercises[currentExerciseIdx];
  if (!currentExercise) return null;

  const progress = ((currentExerciseIdx / exercises.length) * 100);
  const currentExerciseSets = loggedSets.filter(s => s.exercise_id === currentExercise.id);

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide">
            {planName.toUpperCase()}
          </p>
          <p className="font-caption text-[10px] font-light text-[var(--color-text-3)]">
            Exercise {currentExerciseIdx + 1} of {exercises.length}
          </p>
        </div>
        <Link href="/workouts" className="w-8 h-8 rounded-[8px] bg-[var(--color-surface-2)] flex items-center justify-center border border-[var(--color-border)]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </Link>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--color-surface-2)] mx-4">
        <div className="h-full bg-[#2563EB] transition-all" style={{ width: `${progress}%` }}/>
      </div>

      {/* Exercise name */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <motion.div 
          key={currentExerciseIdx} 
          initial={{ opacity: 0, y: 16 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="text-center"
        >
          <h2 className="font-heading text-[2rem] text-[var(--color-text-1)] tracking-wide leading-tight capitalize">
            {currentExercise.name.replace(/_/g, " ")}
          </h2>
          <p className="font-caption text-[11px] font-light text-[var(--color-text-3)] mt-2">
            Set {currentSetNumber} of {currentExercise.sets} • Target: {currentExercise.reps} reps
          </p>
        </motion.div>

        {/* Sets completed */}
        <div className="flex gap-2">
          {Array.from({ length: currentExercise.sets }).map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 w-12 rounded-full transition-all ${
                i < currentExerciseSets.length 
                  ? "bg-[#22C55E]" 
                  : i === currentExerciseSets.length 
                  ? "bg-[#2563EB]" 
                  : "bg-[var(--color-surface-2)]"
              }`}
            />
          ))}
        </div>

        {/* Weight and reps inputs */}
        <div className="flex gap-8">
          {[
            { label: "WEIGHT", unit: "kg", value: weight, setValue: setWeight, step: 2.5 },
            { label: "REPS", unit: "reps", value: reps, setValue: setReps, step: 1 },
          ].map(({ label, unit, value, setValue, step }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <p className="font-caption text-[9px] font-light text-[var(--color-text-3)] uppercase tracking-widest">
                {label}
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setValue(Math.max(0, value - step))}
                  className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                  </svg>
                </button>
                <span className="font-metric text-[2.25rem] text-[var(--color-text-1)] w-20 text-center">
                  {value}
                </span>
                <button 
                  onClick={() => setValue(value + step)}
                  className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <p className="font-caption text-[9px] font-light text-[var(--color-text-3)]">{unit}</p>
            </div>
          ))}
        </div>

        {/* Previous sets for this exercise */}
        {currentExerciseSets.length > 0 && (
          <div className="w-full max-w-sm">
            <p className="font-caption text-[10px] text-[var(--color-text-3)] mb-2 uppercase tracking-wide">
              Completed Sets
            </p>
            <div className="flex flex-col gap-2">
              {currentExerciseSets.map((set, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                >
                  <span className="font-body text-[12px] text-[var(--color-text-2)]">Set {set.set_number}</span>
                  <span className="font-body font-bold text-[13px] text-[var(--color-text-1)]">
                    {set.weight}kg × {set.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="px-4 pb-8 flex gap-3">
        {isResting ? (
          <div className="flex-1 h-14 rounded-[14px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center">
            <p className="font-body font-bold text-[var(--color-text-2)] text-[14px]">
              Rest: {restTimeLeft}s
            </p>
          </div>
        ) : currentSetNumber > currentExercise.sets ? (
          <>
            {currentExerciseIdx < exercises.length - 1 ? (
              <button
                onClick={nextExercise}
                className="flex-1 h-14 rounded-[14px] bg-[#2563EB] text-white font-body font-bold text-[15px] flex items-center justify-center gap-2"
              >
                Next Exercise →
              </button>
            ) : (
              <button
                onClick={completeWorkout}
                className="flex-1 h-14 rounded-[14px] bg-[#22C55E] text-white font-body font-bold text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Complete Workout
              </button>
            )}
          </>
        ) : (
          <button
            onClick={logSet}
            disabled={weight === 0 || reps === 0}
            className="flex-1 h-14 rounded-[14px] bg-[#22C55E] text-white font-body font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Log Set
          </button>
        )}
      </div>
    </div>
  );
}
