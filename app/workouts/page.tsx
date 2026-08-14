"use client";

import { useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import GlowCard from "@/components/ui/GlowCard";
import Button from "@/components/ui/Button";
import ScrollReveal from "@/components/ui/ScrollReveal";
import WeeklyWorkoutPlanner from "@/components/workout/WeeklyWorkoutPlanner";

import { useUserStore } from "@/lib/store/user";

// ---------------------------------------------------------------------------
// Inline helpers (mirrors nutrition/page.tsx pattern)
// ---------------------------------------------------------------------------

/** Formats a YYYY-MM-DD string to a human-readable label, e.g. "Mon, Jun 3" */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Today's date as YYYY-MM-DD */
function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// WorkoutsPage — simplified to show only Weekly Workout Planner
// ---------------------------------------------------------------------------

export default function WorkoutsPage() {
  const userId = useUserStore((s) => s.email);
  const [date] = useState<string>(today());

  return (
    <div className="flex flex-col pb-24">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <PageHeader title="WORKOUT" subtitle={formatDate(date)} />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Workout Tracking Link */}
        <ScrollReveal direction="up" delay={0}>
          <Link href="/workouts/tracking">
            <GlowCard glowColor="34,197,94" className="cursor-pointer hover:scale-[1.02] transition-transform">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-1">
                    TRACK WORKOUT SESSION
                  </p>
                  <p className="font-body text-[12px] text-[var(--color-text-2)]">
                    Log sets, track progress, view history
                  </p>
                </div>
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none"
                  className="text-[var(--color-text-3)]"
                >
                  <path 
                    d="M9 18l6-6-6-6" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </GlowCard>
          </Link>
        </ScrollReveal>

        {/* Weekly Workout Planner */}
        <ScrollReveal direction="up" delay={0.1}>
          <GlowCard glowColor="37,99,235">
            <div className="p-4">
              <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide mb-3">
                ANDI WORKOUT PLAN
              </p>
              <WeeklyWorkoutPlanner userId={userId ?? ""} />
            </div>
          </GlowCard>
        </ScrollReveal>
      </div>
    </div>
  );
}
