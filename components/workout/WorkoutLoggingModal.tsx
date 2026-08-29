"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
}

interface SetEntry {
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | undefined;
}

interface WorkoutLoggingModalProps {
  isOpen: boolean;
  userId: string;
  date: string; // YYYY-MM-DD
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MUSCLE_CHIPS = [
  { value: "", label: "All" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "legs", label: "Legs" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "core", label: "Core" },
  { value: "full_body", label: "Cardio" },
];

const EQUIPMENT_CHIPS = [
  { value: "", label: "Any" },
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "resistance_band", label: "Bands" },
];

function formatExerciseName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function muscleGroupColor(mg: string): string {
  const map: Record<string, string> = {
    chest: "bg-blue-100 text-blue-700",
    back: "bg-green-100 text-green-700",
    legs: "bg-orange-100 text-orange-700",
    shoulders: "bg-purple-100 text-purple-700",
    arms: "bg-yellow-100 text-yellow-700",
    core: "bg-red-100 text-red-700",
    full_body: "bg-gray-100 text-gray-600",
  };
  return map[mg] ?? "bg-gray-100 text-gray-600";
}

interface ParsedFilters {
  nameFilter: string;
  muscleGroup: string;
  equipment: string;
}

// ─── Step 1: Exercise Search ──────────────────────────────────────────────────

function ExerciseSearch({ onSelect }: { onSelect: (ex: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [parsed, setParsed] = useState<ParsedFilters | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string, mg: string, eq: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (q) params.set("q", q);
      if (mg) params.set("muscle_group", mg);
      if (eq) params.set("equipment", eq);
      const res = await fetch(`/api/workout/exercise-search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.exercises ?? []);
      setParsed(data.parsed ?? null);
    } catch {
      setError("Could not load exercises");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { search("", "", ""); }, [search]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    // If user types a pure keyword that matches a chip, auto-select it visually
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val, muscleFilter, equipmentFilter), 280);
  };

  const handleMuscleChip = (val: string) => {
    const next = muscleFilter === val ? "" : val;
    setMuscleFilter(next);
    search(query, next, equipmentFilter);
  };

  const handleEquipmentChip = (val: string) => {
    const next = equipmentFilter === val ? "" : val;
    setEquipmentFilter(next);
    search(query, muscleFilter, next);
  };

  // Active filters from smart-parse (only those NOT covered by chip selection)
  const smartMuscle = (!muscleFilter && parsed?.muscleGroup) ? parsed.muscleGroup : "";
  const smartEquipment = (!equipmentFilter && parsed?.equipment) ? parsed.equipment : "";

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-3)]"
          width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder='Try "chest dumbbell", "cable back", "cardio", "squat"…'
          className="w-full pl-10 pr-4 h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-1)] font-body text-[14px] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#2563EB] transition-colors"
        />
      </div>

      {/* Smart-parsed filter tags (shown when query understood something) */}
      {(smartMuscle || smartEquipment) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-caption text-[10px] text-[var(--color-text-3)] uppercase tracking-wider">Filtered by:</span>
          {smartMuscle && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF4FF] border border-[#BFDBFE] font-caption text-[11px] text-[#2563EB]">
              {smartMuscle.replace(/_/g, " ")}
              <button onClick={() => { setQuery(""); search("", muscleFilter, equipmentFilter); }} aria-label="Clear" className="opacity-60 hover:opacity-100">×</button>
            </span>
          )}
          {smartEquipment && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF4FF] border border-[#BFDBFE] font-caption text-[11px] text-[#2563EB]">
              {smartEquipment.replace(/_/g, " ")}
              <button onClick={() => { setQuery(""); search("", muscleFilter, equipmentFilter); }} aria-label="Clear" className="opacity-60 hover:opacity-100">×</button>
            </span>
          )}
        </div>
      )}

      {/* Muscle group chips */}
      <div>
        <p className="font-caption text-[10px] text-[var(--color-text-3)] uppercase tracking-wider mb-1.5">Muscle Group</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {MUSCLE_CHIPS.map((mg) => {
            const active = muscleFilter === mg.value || (!muscleFilter && !mg.value);
            return (
              <button
                key={mg.value}
                onClick={() => handleMuscleChip(mg.value)}
                className={[
                  "shrink-0 px-3 h-7 rounded-full font-caption text-[11px] font-semibold transition-all",
                  active
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-2)] border border-[var(--color-border)] hover:border-[#2563EB]/50",
                ].join(" ")}
              >
                {mg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipment chips */}
      <div>
        <p className="font-caption text-[10px] text-[var(--color-text-3)] uppercase tracking-wider mb-1.5">Equipment</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {EQUIPMENT_CHIPS.map((eq) => {
            const active = equipmentFilter === eq.value || (!equipmentFilter && !eq.value);
            return (
              <button
                key={eq.value}
                onClick={() => handleEquipmentChip(eq.value)}
                className={[
                  "shrink-0 px-3 h-7 rounded-full font-caption text-[11px] font-semibold transition-all",
                  active
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-2)] border border-[var(--color-border)] hover:border-[#0F172A]/40",
                ].join(" ")}
              >
                {eq.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-2 mt-1">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[58px] rounded-[12px] bg-[var(--color-surface-2)] animate-pulse" />
            ))}
          </div>
        )}
        {!isLoading && error && (
          <p className="text-[13px] text-red-500 text-center py-4">{error}</p>
        )}
        {!isLoading && !error && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-[13px] text-[var(--color-text-3)] italic">No exercises found</p>
            <p className="text-[11px] text-[var(--color-text-3)]">Try different keywords or clear the filters</p>
          </div>
        )}
        {!isLoading && results.map((ex) => (
          <button
            key={ex.id}
            onClick={() => onSelect(ex)}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 hover:border-[#2563EB]/60 hover:bg-[var(--color-surface-3)] transition-all text-left"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-body font-medium text-[14px] text-[var(--color-text-1)] truncate">
                {formatExerciseName(ex.name)}
              </span>
              <span className="font-caption text-[11px] text-[var(--color-text-3)] capitalize">
                {ex.equipment.replace(/_/g, " ")}
              </span>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full font-caption text-[10px] font-semibold capitalize ${muscleGroupColor(ex.muscle_group)}`}>
              {ex.muscle_group.replace(/_/g, " ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Set Logger ───────────────────────────────────────────────────────

function SetLogger({
  exercise,
  onBack,
  onLog,
  isSaving,
}: {
  exercise: Exercise;
  onBack: () => void;
  onLog: (sets: SetEntry[]) => void;
  isSaving: boolean;
}) {
  const isCardio = exercise.muscle_group === "full_body";

  const [sets, setSets] = useState<SetEntry[]>([
    { set_number: 1, weight_kg: 0, reps: isCardio ? 30 : 10, rpe: undefined },
  ]);

  const addSet = () => {
    setSets((prev) => [
      ...prev,
      {
        set_number: prev.length + 1,
        weight_kg: 0,
        reps: prev[prev.length - 1].reps,
        rpe: undefined,
      },
    ]);
  };

  const removeSet = (idx: number) => {
    setSets((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, set_number: i + 1 }))
    );
  };

  const updateSet = (idx: number, field: keyof SetEntry, value: number | undefined) => {
    setSets((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const canLog = sets.every((s) => s.reps > 0);

  // Labels change based on cardio vs strength
  const colHeaderReps = isCardio ? "Time (min)" : "Reps";
  const sessionLabel  = isCardio ? "Session" : "#";
  const addLabel      = isCardio ? "+ Add Session" : "+ Add Set";

  return (
    <div className="flex flex-col gap-4">
      {/* Exercise header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 shrink-0 rounded-[8px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center hover:border-[#2563EB]/60 transition-colors"
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-body font-bold text-[15px] text-[var(--color-text-1)] truncate">
            {formatExerciseName(exercise.name)}
          </p>
          <p className="font-caption text-[11px] text-[var(--color-text-3)] capitalize">
            {exercise.muscle_group.replace(/_/g, " ")} · {exercise.equipment.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      {/* Column headers */}
      {isCardio ? (
        <div className="grid grid-cols-[52px_1fr_56px_32px] gap-2 px-1">
          {([sessionLabel, colHeaderReps, "RPE", ""] as const).map((h) => (
            <span key={h} className="font-caption text-[10px] text-[var(--color-text-3)] uppercase tracking-widest text-center">
              {h}
            </span>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[28px_1fr_1fr_56px_32px] gap-2 px-1">
          {(["#", "Weight (kg)", "Reps", "RPE", ""] as const).map((h) => (
            <span key={h} className="font-caption text-[10px] text-[var(--color-text-3)] uppercase tracking-widest text-center">
              {h}
            </span>
          ))}
        </div>
      )}

      {/* Set / session rows */}
      <div className="flex flex-col gap-2">
        {sets.map((set, idx) => (
          isCardio ? (
            /* ── Cardio row: Session label | Time stepper | RPE | Remove ── */
            <div key={idx} className="grid grid-cols-[52px_1fr_56px_32px] gap-2 items-center">

              {/* Session label */}
              <span className="font-caption text-[11px] text-[var(--color-text-3)] text-center leading-none">
                {idx + 1}
              </span>

              {/* Time stepper (minutes) */}
              <div className="flex items-center h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => updateSet(idx, "reps", Math.max(1, set.reps - 5))}
                  className="w-8 shrink-0 h-full flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)] transition-colors font-bold text-[16px]"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={set.reps}
                  onChange={(e) => updateSet(idx, "reps", parseInt(e.target.value) || 1)}
                  className="flex-1 min-w-0 bg-transparent text-center font-metric text-[13px] text-[var(--color-text-1)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => updateSet(idx, "reps", set.reps + 5)}
                  className="w-8 shrink-0 h-full flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)] transition-colors font-bold text-[16px]"
                >
                  +
                </button>
              </div>

              {/* RPE */}
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max="10"
                step="0.5"
                value={set.rpe ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  updateSet(idx, "rpe", isNaN(v) ? undefined : v);
                }}
                placeholder="—"
                className="w-full h-10 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[10px] text-center font-metric text-[13px] text-[var(--color-text-1)] focus:outline-none focus:border-[#2563EB] placeholder:text-[var(--color-text-3)]"
              />

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeSet(idx)}
                disabled={sets.length === 1}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[var(--color-text-3)] hover:text-red-500 disabled:opacity-25 transition-colors"
                aria-label="Remove session"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

            </div>
          ) : (
            /* ── Strength row: # | Weight stepper | Reps stepper | RPE | Remove ── */
            <div key={idx} className="grid grid-cols-[28px_1fr_1fr_56px_32px] gap-2 items-center">

              {/* Set number */}
              <span className="font-metric text-[13px] text-[var(--color-text-3)] text-center leading-none">
                {set.set_number}
              </span>

              {/* Weight stepper */}
              <div className="flex items-center h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => updateSet(idx, "weight_kg", Math.max(0, set.weight_kg - 2.5))}
                  className="w-8 shrink-0 h-full flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)] transition-colors font-bold text-[16px]"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={set.weight_kg === 0 ? "" : set.weight_kg}
                  onChange={(e) => updateSet(idx, "weight_kg", parseFloat(e.target.value) || 0)}
                  className="flex-1 min-w-0 bg-transparent text-center font-metric text-[13px] text-[var(--color-text-1)] focus:outline-none"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => updateSet(idx, "weight_kg", set.weight_kg + 2.5)}
                  className="w-8 shrink-0 h-full flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)] transition-colors font-bold text-[16px]"
                >
                  +
                </button>
              </div>

              {/* Reps stepper */}
              <div className="flex items-center h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => updateSet(idx, "reps", Math.max(1, set.reps - 1))}
                  className="w-8 shrink-0 h-full flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)] transition-colors font-bold text-[16px]"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={set.reps}
                  onChange={(e) => updateSet(idx, "reps", parseInt(e.target.value) || 1)}
                  className="flex-1 min-w-0 bg-transparent text-center font-metric text-[13px] text-[var(--color-text-1)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => updateSet(idx, "reps", set.reps + 1)}
                  className="w-8 shrink-0 h-full flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)] transition-colors font-bold text-[16px]"
                >
                  +
                </button>
              </div>

              {/* RPE */}
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max="10"
                step="0.5"
                value={set.rpe ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  updateSet(idx, "rpe", isNaN(v) ? undefined : v);
                }}
                placeholder="—"
                className="w-full h-10 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[10px] text-center font-metric text-[13px] text-[var(--color-text-1)] focus:outline-none focus:border-[#2563EB] placeholder:text-[var(--color-text-3)]"
              />

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeSet(idx)}
                disabled={sets.length === 1}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[var(--color-text-3)] hover:text-red-500 disabled:opacity-25 transition-colors"
                aria-label="Remove set"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

            </div>
          )
        ))}
      </div>

      {/* BW badge for cardio */}
      {isCardio && (
        <div className="flex items-center gap-2 px-1">
          <span className="px-2.5 py-1 rounded-[8px] bg-[var(--color-surface-2)] border border-[var(--color-border)] font-caption text-[11px] font-semibold text-[var(--color-text-2)] uppercase tracking-wide">
            BW
          </span>
          <span className="font-caption text-[11px] text-[var(--color-text-3)]">
            Bodyweight — no load tracked
          </span>
        </div>
      )}

      {/* Add set / session */}
      <button
        type="button"
        onClick={addSet}
        className="flex items-center justify-center gap-2 h-10 rounded-[12px] border border-dashed border-[var(--color-border)] text-[var(--color-text-3)] hover:border-[#2563EB]/60 hover:text-[#2563EB] font-body text-[13px] transition-all"
      >
        {addLabel}
      </button>

      {/* Log button */}
      <Button
        variant="primary"
        size="md"
        fullWidth
        onClick={() => onLog(sets)}
        disabled={!canLog || isSaving}
        loading={isSaving}
      >
        Log Exercise
      </Button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function WorkoutLoggingModal({
  isOpen,
  userId,
  date,
  onClose,
  onSuccess,
}: WorkoutLoggingModalProps) {
  const [step, setStep] = useState<"search" | "sets">("search");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Force scroll styles directly on the DOM element
      node.style.setProperty('overflow-y', 'scroll', 'important');
      node.style.setProperty('overflow-x', 'hidden', 'important');
      node.style.setProperty('-webkit-overflow-scrolling', 'touch');
    }
  }, []);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep("search");
      setSelectedExercise(null);
      setError(null);
    }
  }, [isOpen]);

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedExercise(ex);
    setStep("sets");
    setError(null);
  };

  const handleLog = async (sets: SetEntry[]) => {
    if (!selectedExercise) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workout/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          date,
          exercise_id: selectedExercise.id,
          exercise_name: selectedExercise.name,
          sets: sets.map((s) => ({
            set_number: s.set_number,
            weight_kg: s.weight_kg,
            reps: s.reps,
            rpe: s.rpe,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to log workout");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log workout");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Log workout"
        >
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 max-h-[90vh] w-full sm:max-w-lg rounded-t-[24px] sm:rounded-[20px] bg-[var(--color-surface-1)] flex flex-col"
            style={{ height: 'min(90vh, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <h2 className="font-heading text-[18px] font-bold text-[var(--color-text-1)]">
                {step === "search" ? "Log Exercise" : "Add Sets"}
              </h2>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)] transition-colors"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-5 mb-2 px-4 py-3 rounded-[12px] bg-red-50 border border-red-200 text-red-600 font-body text-[13px] shrink-0">
                {error}
              </div>
            )}

            {/* Scrollable content */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 px-5 pb-6 pt-4 force-scroll"
              style={{ 
                minHeight: 0,
                overscrollBehavior: "contain"
              }}
            >
              {step === "search" ? (
                <ExerciseSearch onSelect={handleSelectExercise} />
              ) : (
                <SetLogger
                  exercise={selectedExercise!}
                  onBack={() => setStep("search")}
                  onLog={handleLog}
                  isSaving={isSaving}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
