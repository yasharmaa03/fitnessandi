"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store/user";
import PageHeader from "@/components/layout/PageHeader";
import GlowCard from "@/components/ui/GlowCard";
import Button from "@/components/ui/Button";
import SessionLogger from "@/components/workout/SessionLogger";
import ProgressHistory from "@/components/workout/ProgressHistory";
import ScrollReveal from "@/components/ui/ScrollReveal";

/** Today's date as YYYY-MM-DD */
function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formats a YYYY-MM-DD string to a human-readable label */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function WorkoutTrackingPage() {
  const router = useRouter();
  const supabase = createClient();
  const userId = useUserStore((s) => s.email);
  
  const [date] = useState<string>(today());
  const [activeWorkout, setActiveWorkout] = useState<{
    id: string;
    plan_id: string;
  } | null>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for active workout session
  useEffect(() => {
    if (!userId) return;

    async function checkActiveSession() {
      try {
        const { data, error } = await supabase
          .from("workout_logs")
          .select("id, plan_id, status")
          .eq("user_id", userId)
          .eq("status", "in_progress")
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setActiveWorkout({ id: data.id, plan_id: data.plan_id });
        }
      } catch (err) {
        console.error("Error checking active session:", err);
      } finally {
        setLoading(false);
      }
    }

    checkActiveSession();
  }, [userId, supabase]);

  // Fetch available workout plans
  useEffect(() => {
    if (!userId || activeWorkout) return;

    async function fetchPlans() {
      try {
        const { data, error } = await supabase
          .from("workout_plans")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setAvailablePlans(data || []);
        if (data && data.length > 0) {
          setSelectedPlanId(data[0].id);
        }
      } catch (err) {
        console.error("Error fetching plans:", err);
        setError("Failed to load workout plans");
      }
    }

    fetchPlans();
  }, [userId, activeWorkout, supabase]);

  // Start a new workout session
  const handleStartWorkout = async () => {
    if (!userId || !selectedPlanId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/workout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          plan_id: selectedPlanId,
          date: date,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start workout");
      }

      const session = await response.json();
      setActiveWorkout({ id: session.id, plan_id: selectedPlanId });
    } catch (err) {
      console.error("Error starting workout:", err);
      setError(err instanceof Error ? err.message : "Failed to start workout");
    } finally {
      setLoading(false);
    }
  };

  // Handle workout completion
  const handleComplete = () => {
    setActiveWorkout(null);
    setSelectedPlanId("");
  };

  if (!userId) {
    return (
      <div className="flex flex-col pb-24">
        <PageHeader title="WORKOUT TRACKING" subtitle="Please log in" />
        <div className="px-4 py-8">
          <GlowCard className="p-6 text-center">
            <p className="text-[var(--color-text-2)]">
              Please log in to track your workouts.
            </p>
          </GlowCard>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col pb-24">
        <PageHeader title="WORKOUT TRACKING" subtitle={formatDate(date)} />
        <div className="px-4 py-8">
          <GlowCard className="p-6">
            <div className="animate-pulse flex flex-col gap-4">
              <div className="h-32 bg-[var(--color-surface-2)] rounded-[12px]" />
              <div className="h-48 bg-[var(--color-surface-2)] rounded-[12px]" />
            </div>
          </GlowCard>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24">
      <PageHeader title="WORKOUT TRACKING" subtitle={formatDate(date)} />

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Active Workout Session */}
        {activeWorkout ? (
          <ScrollReveal direction="up" delay={0}>
            <SessionLogger
              workoutId={activeWorkout.id}
              planId={activeWorkout.plan_id}
              userId={userId}
              onComplete={handleComplete}
            />
          </ScrollReveal>
        ) : (
          /* Start Workout Section */
          <ScrollReveal direction="up" delay={0}>
            <GlowCard glowColor="37,99,235">
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <h3 className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-2">
                    START WORKOUT
                  </h3>
                  <p className="font-body text-[13px] text-[var(--color-text-2)]">
                    Choose a workout plan to begin tracking your session
                  </p>
                </div>

                {error && (
                  <div className="text-[13px] font-body text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[10px] px-4 py-3">
                    {error}
                  </div>
                )}

                {availablePlans.length > 0 ? (
                  <>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="h-12 px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] font-body text-[15px] text-[var(--color-text-1)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-shadow"
                    >
                      {availablePlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={handleStartWorkout}
                      disabled={!selectedPlanId || loading}
                      loading={loading}
                    >
                      Start Workout
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="font-body text-[14px] text-[var(--color-text-2)] mb-4">
                      No workout plans found. Create a plan first to start tracking.
                    </p>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => router.push("/workouts")}
                    >
                      Go to Workout Planner
                    </Button>
                  </div>
                )}
              </div>
            </GlowCard>
          </ScrollReveal>
        )}

        {/* Workout History - only show when not in active session */}
        {!activeWorkout && (
          <ScrollReveal direction="up" delay={0.1}>
            <GlowCard>
              <div className="p-6">
                <h3 className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-4">
                  WORKOUT HISTORY
                </h3>
                <ProgressHistory userId={userId} />
              </div>
            </GlowCard>
          </ScrollReveal>
        )}
      </div>
    </div>
  );
}
