"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import PageHeader from "@/components/layout/PageHeader";
import GlowCard from "@/components/ui/GlowCard";
import ScrollReveal from "@/components/ui/ScrollReveal";
import WorkoutLog from "@/components/workout/WorkoutLog";
import WorkoutHistory from "@/components/workout/WorkoutHistory";
import WorkoutLoggingModal from "@/components/workout/WorkoutLoggingModal";
import WeeklyWorkoutPlanner from "@/components/workout/WeeklyWorkoutPlanner";

import { useUserStore } from "@/lib/store/user";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function offsetDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// DateNavigator — same pattern as nutrition page
// ---------------------------------------------------------------------------

function DateNavigator({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (d: string) => void;
}) {
  const isToday = date === today();

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <button
        onClick={() => onDateChange(offsetDate(date, -1))}
        className="w-9 h-9 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center hover:border-[#2563EB]/40 transition-colors"
        aria-label="Previous day"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7l4 4" stroke="var(--color-text-2)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="flex flex-col items-center gap-0.5">
        <span className="font-body font-bold text-[13px] text-[var(--color-text-1)]">
          {formatDate(date)}
        </span>
        {isToday && (
          <span className="font-caption text-[9px] font-light text-[#2563EB] bg-[#EEF4FF] border border-[#BFDBFE] px-2 py-0.5 rounded-full">
            Today
          </span>
        )}
      </div>

      <button
        onClick={() => onDateChange(offsetDate(date, +1))}
        className="w-9 h-9 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center hover:border-[#2563EB]/40 transition-colors"
        aria-label="Next day"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="var(--color-text-2)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner dashboard (must be inside QueryClientProvider)
// ---------------------------------------------------------------------------

function WorkoutDashboard() {
  const userId = useUserStore((s) => s.email);
  const [date, setDate] = useState<string>(today());
  const [view, setView] = useState<"log" | "history">("log");
  const [showLogModal, setShowLogModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleLogSuccess = () => {
    setShowLogModal(false);
    queryClient.invalidateQueries({ queryKey: ["workout-daily-log", userId, date] });
    queryClient.invalidateQueries({ queryKey: ["workout-week-history", userId] });
    setToastMessage("Exercise logged ✓");
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col pb-24">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <PageHeader title="WORKOUT" />

      {/* ── Date navigator ───────────────────────────────────────────────── */}
      <DateNavigator date={date} onDateChange={setDate} />

      <div className="flex flex-col gap-4 px-4 py-4">

        {/* ── Combined log + history block ─────────────────────────────── */}
        <ScrollReveal direction="up" delay={0}>
          <GlowCard glowColor="37,99,235">
            <div className="p-4">

              {/* Header row with toggle buttons */}
              <div className="flex items-center justify-between mb-4">
                {/* Left: title */}
                <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide">
                  WORKOUTS
                </p>

                {/* Right: view toggle */}
                <div className="flex rounded-[10px] border border-[var(--color-border)] overflow-hidden">
                  <button
                    onClick={() => setView("log")}
                    className={[
                      "h-8 px-3 font-body font-bold text-[12px] transition-colors",
                      view === "log"
                        ? "bg-[var(--color-surface-3)] text-[var(--color-text-1)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-3)] hover:text-[var(--color-text-2)]",
                    ].join(" ")}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setView("history")}
                    className={[
                      "h-8 px-3 font-body font-bold text-[12px] border-l border-[var(--color-border)] transition-colors",
                      view === "history"
                        ? "bg-[var(--color-surface-3)] text-[var(--color-text-1)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-3)] hover:text-[var(--color-text-2)]",
                    ].join(" ")}
                  >
                    History
                  </button>
                </div>
              </div>

              {/* View content */}
              <AnimatePresence mode="wait">
                {view === "log" ? (
                  <motion.div
                    key="log"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                  >
                    <WorkoutLog
                      userId={userId ?? ""}
                      date={date}
                      onLogWorkout={() => setShowLogModal(true)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.18 }}
                  >
                    <WorkoutHistory userId={userId ?? ""} />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </GlowCard>
        </ScrollReveal>

        {/* ── Andi Workout Plan ────────────────────────────────────────── */}
        <ScrollReveal direction="up" delay={0.05}>
          <GlowCard glowColor="245,158,11">
            <div className="p-4">
              <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-3">
                ANDI WORKOUT PLAN
              </p>
              <WeeklyWorkoutPlanner userId={userId ?? ""} />
            </div>
          </GlowCard>
        </ScrollReveal>

      </div>

      {/* ── Log Modal ─────────────────────────────────────────────────── */}
      <WorkoutLoggingModal
        isOpen={showLogModal}
        userId={userId ?? ""}
        date={date}
        onClose={() => setShowLogModal(false)}
        onSuccess={handleLogSuccess}
      />

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-[14px] bg-[#1E293B] text-white font-body font-bold text-[14px] shadow-[0_8px_32px_rgba(0,0,0,.3)]"
            role="status"
            aria-live="polite"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper — provides a stable QueryClient
// ---------------------------------------------------------------------------

export default function WorkoutsPage() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WorkoutDashboard />
    </QueryClientProvider>
  );
}
