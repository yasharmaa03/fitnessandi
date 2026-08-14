"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store/user";
import SessionLogger from "@/components/workout/SessionLogger";
import Link from "next/link";

export default function SessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const userId = useUserStore((s) => s.email);

  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get workoutId and planId from URL params or active session
  useEffect(() => {
    async function initializeSession() {
      const urlWorkoutId = searchParams.get("workoutId");
      const urlPlanId = searchParams.get("planId");

      if (urlWorkoutId && urlPlanId) {
        setWorkoutId(urlWorkoutId);
        setPlanId(urlPlanId);
        setLoading(false);
        return;
      }

      // Check for active session
      if (!userId) {
        router.push("/workouts");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("workout_logs")
          .select("id, plan_id")
          .eq("user_id", userId)
          .eq("status", "in_progress")
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setWorkoutId(data.id);
          setPlanId(data.plan_id);
        } else {
          // No active session, redirect to start one
          router.push("/workouts/tracking");
        }
      } catch (err) {
        console.error("Error loading session:", err);
        router.push("/workouts");
      } finally {
        setLoading(false);
      }
    }

    initializeSession();
  }, [userId, searchParams, router, supabase]);

  const handleComplete = () => {
    router.push("/workouts");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="animate-pulse">
          <p className="text-[var(--color-text-2)]">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (!workoutId || !planId || !userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      <SessionLogger
        workoutId={workoutId}
        planId={planId}
        userId={userId}
        onComplete={handleComplete}
      />
    </div>
  );
}
