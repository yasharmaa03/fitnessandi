"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useUserStore } from "@/lib/store/user";
import DonutRing from "@/components/ui/DonutRing";
import ProgressBar from "@/components/ui/ProgressBar";
import Chip from "@/components/ui/Chip";
import CountUp from "@/components/ui/CountUp";
import TextHighlight from "@/components/ui/TextHighlight";
import ClickSpark from "@/components/ui/ClickSpark";
import Grainient from "@/components/ui/Grainient";
import GlowCard from "@/components/ui/GlowCard";
import ScrollReveal from "@/components/ui/ScrollReveal";
import WhatsAppOptInModal from "@/components/WhatsAppOptInModal";

const hero: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const pop: Variants  = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const macros = [
  { label: "Calories", val: 1240, goal: 1850, unit: "kcal", color: "#2563EB", rgb: "37,99,235" },
  { label: "Protein",  val: 76,   goal: 130,  unit: "g",    color: "#22C55E", rgb: "34,197,94" },
  { label: "Carbs",    val: 142,  goal: 185,  unit: "g",    color: "#F59E0B", rgb: "245,158,11" },
  { label: "Fat",      val: 38,   goal: 55,   unit: "g",    color: "#EF4444", rgb: "239,68,68" },
];

const meals = [
  { name: "Breakfast", time: "8:14 AM", kcal: 380, logged: true },
  { name: "Lunch",     time: "1:30 PM", kcal: 560, logged: true },
  { name: "Dinner",    time: "",        kcal: 0,   logged: false },
  { name: "Snacks",    time: "",        kcal: 0,   logged: false },
];

const BMI_SUGGESTIONS: Record<string, { text: string; color: string }> = {
  "Underweight": { text: "Your BMI suggests you need more calories. Andi has added 400kcal surplus and strength-building workouts to your plan.", color: "#60A5FA" },
  "Normal":      { text: "Great BMI range. Andi is focused on body recomposition — maintaining muscle while optimizing fat distribution.", color: "#4ADE80" },
  "Overweight":  { text: "Andi has calibrated a 500kcal deficit with steady-state cardio and progressive resistance training to your plan.", color: "#FCD34D" },
  "Obese":       { text: "Andi recommends starting with low-impact activities. Your plan is set to a gradual deficit with daily movement goals.", color: "#F87171" },
};

export default function DashboardPage() {
  const { firstName, avatar, workoutStreak, nutritionStreak, waterStreak, stepsToday, stepsGoal, heartRate, sleepHours, waterLiters, waterGoal, bmi, bmiCategory, whatsappOptIn, hasSeenWhatsappPrompt } = useUserStore();
  const [waterCount, setWaterCount] = useState(7);
  // Local override for this session only — the store fields are the source of
  // truth (updated by the modal itself once the user answers, and rehydrated
  // from localStorage after mount for returning users).
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const whatsappPromptOpen = !whatsappOptIn && !hasSeenWhatsappPrompt && !dismissedThisSession;

  const name = firstName || "Athlete";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const stepsPercent = Math.min((stepsToday / stepsGoal) * 100, 100);
  const totalStreak = workoutStreak + nutritionStreak + waterStreak;
  const bmiSuggestion = bmiCategory ? BMI_SUGGESTIONS[bmiCategory] || BMI_SUGGESTIONS["Normal"] : null;

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6">

      {/* ── Top bar ── */}
      <motion.div variants={hero} initial="hidden" animate="show" className="flex items-center justify-between mb-1">
        <motion.div variants={pop}>
          <p className="font-caption text-[10px] font-light text-[var(--color-text-3)] uppercase tracking-widest">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
          <h1 className="font-heading text-[1.375rem] text-[var(--color-text-1)] tracking-wide leading-tight transition-colors">
            {greeting.toUpperCase()},{" "}
            <TextHighlight color="#2563EB" delay={0.4}>
              <span className="text-[var(--color-primary)]">{name.toUpperCase()}</span>
            </TextHighlight>
          </h1>
        </motion.div>
        <motion.div variants={pop}>
          <Link href="/profile">
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
              className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] border-2 border-[var(--color-primary)] flex items-center justify-center">
              <span className="font-heading text-[13px] text-[var(--color-primary)]">{avatar || "AR"}</span>
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>

      {/* ── Hero Streak Card (prominent, dashboard integrated) ── */}
      <ScrollReveal direction="up" delay={0.02}>
        <GlowCard glowColor="245,158,11" glowSize={500} className="border-0 overflow-hidden">
          <Grainient from="#0A1628" to="#1A2D1A" angle={145} className="h-full">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1.5L9.5 6H14L10.5 8.5l1.5 4.5L8 10.5l-4 2.5 1.5-4.5L2 6h4.5L8 1.5z" fill="#F59E0B"/>
                      </svg>
                    </motion.div>
                    <span className="font-caption text-[9px] font-light text-white/50 uppercase tracking-widest">Active Streaks</span>
                  </div>
                  <p className="font-metric text-[2.5rem] text-[#F59E0B] leading-none">
                    <CountUp to={totalStreak} duration={1.8}/>
                  </p>
                  <p className="font-caption text-[10px] font-light text-white/40">total streak days</p>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <p className="font-caption text-[8px] font-light text-white/30 uppercase tracking-widest mb-1">Best run</p>
                  <span className="font-metric text-[11px] text-[#F59E0B]">14d workout</span>
                </div>
              </div>

              {/* Three streak tiles */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Workout",   days: workoutStreak,   color: "#3B82F6", icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M1 5h3M10 5h3M1 9h3M10 9h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="1" y="3.5" width="3" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="10" y="3.5" width="3" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg> },
                  { label: "Nutrition", days: nutritionStreak, color: "#4ADE80", icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 7a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                  { label: "Water",     days: waterStreak,     color: "#38BDF8", icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5C7 1.5 3 6 3 9a4 4 0 008 0c0-3-4-7.5-4-7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                ].map((s) => (
                  <motion.div
                    key={s.label}
                    whileHover={{ y: -2, boxShadow: `0 6px 20px rgba(0,0,0,.3)` }}
                    transition={{ duration: 0.18 }}
                    className="rounded-[12px] py-3 px-2 flex flex-col items-center gap-1 bg-white/8 border border-white/10"
                    style={{ color: s.color }}
                  >
                    {s.icon}
                    <CountUp to={s.days} duration={1.4} className="font-metric text-[1.25rem] leading-none"/>
                    <span className="font-caption text-[8px] font-light text-white/40 uppercase tracking-wide">{s.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </Grainient>
        </GlowCard>
      </ScrollReveal>

      {/* ── Row 1: Score + Workout ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ScrollReveal direction="left" delay={0}>
          <GlowCard glowColor="37,99,235">
            <div className="p-4 flex items-center gap-4">
              <DonutRing value={78} size={82} stroke={8} color="#2563EB">
                <CountUp to={78} duration={1.6} className="font-metric text-[1.375rem] text-[var(--color-text-1)]"/>
              </DonutRing>
              <div className="flex-1">
                <p className="font-heading text-[.9375rem] text-[var(--color-text-1)] tracking-wide">TODAY&apos;S SCORE</p>
                <p className="font-body text-[11px] text-[var(--color-text-2)] mb-2">3 of 5 goals complete</p>
                <div className="flex gap-1.5 flex-wrap">
                  <Chip variant="success" className="text-[10px]">Workout done</Chip>
                  <Chip variant="warning" className="text-[10px]">Protein low</Chip>
                </div>
              </div>
            </div>
          </GlowCard>
        </ScrollReveal>

        <ScrollReveal direction="right" delay={0.05}>
          <GlowCard glowColor="37,99,235" className="border-0 overflow-hidden">
            <Grainient from="#0A1628" to="#1E3A5F" angle={135} className="h-full">
              <div className="p-4 flex flex-col min-h-[136px]">
                <p className="font-caption text-[9px] font-light text-white/40 uppercase tracking-widest mb-1">TODAY&apos;S WORKOUT</p>
                <p className="font-heading text-[1.0625rem] text-white tracking-wide mb-1">UPPER BODY STRENGTH</p>
                <p className="font-caption text-[10px] font-light text-white/50 mb-auto">45 min · Intermediate · Chest & Shoulders</p>
                <ClickSpark color="#60A5FA" className="mt-3">
                  <Link href="/workouts"
                    className="h-10 w-full rounded-[10px] bg-[#2563EB] text-white font-body font-bold text-[12px] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(37,99,235,.4)] hover:bg-[#1D4ED8] transition-colors">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1.5l7 4.5-7 4.5V1.5z" fill="white"/></svg>
                    Start Workout
                  </Link>
                </ClickSpark>
              </div>
            </Grainient>
          </GlowCard>
        </ScrollReveal>
      </div>

      {/* ── Health Vitals Row ── */}
      <ScrollReveal delay={0.04}>
        <div className="grid grid-cols-4 gap-2">
          {/* Steps */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}
            className="col-span-2 bg-[var(--color-surface-2)] rounded-[16px] p-3 border border-[var(--color-border)] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="3.5" r="1.5" stroke="#22C55E" strokeWidth="1.5"/>
                  <path d="M5 7l2-2 2 2M7 7v4M5 11l2-1 2 1" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-caption text-[9px] font-light text-[var(--color-text-3)] uppercase tracking-widest">Steps</span>
              </div>
              <span className="font-caption text-[8px] font-light text-[var(--color-text-3)]">{stepsGoal.toLocaleString()} goal</span>
            </div>
            <p className="font-metric text-[1.5rem] text-[#22C55E] leading-none mb-1.5">
              <CountUp to={stepsToday} duration={1.6}/>
            </p>
            <ProgressBar value={stepsPercent} color="#22C55E" height={3}/>
          </motion.div>

          {/* Heart Rate */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}
            className="bg-[var(--color-surface-2)] rounded-[16px] p-3 border border-[var(--color-border)] flex flex-col items-center justify-center transition-colors">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 13s-6-3.5-6-7.5A3.5 3.5 0 018 3a3.5 3.5 0 016 2.5C14 9.5 8 13 8 13z" fill="#EF4444" fillOpacity="0.15" stroke="#EF4444" strokeWidth="1.5"/>
              </svg>
            </motion.div>
            <p className="font-metric text-[1.125rem] text-[#EF4444] leading-none mt-1">{heartRate}</p>
            <p className="font-caption text-[7px] font-light text-[var(--color-text-3)] uppercase tracking-wider mt-0.5">bpm</p>
          </motion.div>

          {/* Sleep */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}
            className="bg-[var(--color-surface-2)] rounded-[16px] p-3 border border-[var(--color-border)] flex flex-col items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 8.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="font-metric text-[1.125rem] text-[#8B5CF6] leading-none mt-1">
              <CountUp to={sleepHours} decimals={1} duration={1.4}/>
            </p>
            <p className="font-caption text-[7px] font-light text-[var(--color-text-3)] uppercase tracking-wider mt-0.5">hrs</p>
          </motion.div>
        </div>
      </ScrollReveal>

      {/* ── BMI Suggestion ── */}
      {bmiSuggestion && (
        <ScrollReveal delay={0.03}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="rounded-[16px] border p-4 bg-[var(--color-surface-2)] transition-colors"
            style={{ borderColor: bmiSuggestion.color + "40" }}
          >
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: bmiSuggestion.color + "20" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v5.5M7 9.5v1" stroke={bmiSuggestion.color} strokeWidth="1.75" strokeLinecap="round"/><circle cx="7" cy="7" r="5.5" stroke={bmiSuggestion.color} strokeWidth="1.25"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-body font-bold text-[12px] text-[var(--color-text-1)]">BMI {bmi} — {bmiCategory}</p>
                  <span className="font-caption text-[8px] font-light px-2 py-0.5 rounded-full border" style={{ color: bmiSuggestion.color, borderColor: bmiSuggestion.color + "60" }}>Andi Insight</span>
                </div>
                <p className="font-body text-[11px] text-[var(--color-text-2)] leading-relaxed">{bmiSuggestion.text}</p>
              </div>
            </div>
          </motion.div>
        </ScrollReveal>
      )}

      {/* ── Row 2: Macros ── */}
      <ScrollReveal delay={0.06}>
        <GlowCard glowColor="37,99,235" glowSize={360}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide">NUTRITION TODAY</p>
              <Link href="/nutrition" className="font-caption text-[10px] font-light text-[var(--color-primary)] hover:opacity-80">View all</Link>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {macros.map((m, i) => (
                <ScrollReveal key={m.label} delay={0.05 * i} direction="up">
                  <div className="flex flex-col items-center gap-1.5">
                    <DonutRing value={(m.val / m.goal) * 100} size={56} stroke={5} color={m.color}>
                      <CountUp to={m.val} duration={1.2} className="font-metric text-[11px]" style={{ color: m.color } as React.CSSProperties}/>
                    </DonutRing>
                    <span className="font-caption text-[9px] font-light text-[var(--color-text-3)]">{m.label}</span>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ProgressBar value={(1240 / 1850) * 100} color="#2563EB"/>
            <div className="flex justify-between mt-1.5">
              <span className="font-caption text-[9px] font-light text-[var(--color-text-3)]"><CountUp to={1240} duration={1.2}/> kcal eaten</span>
              <span className="font-caption text-[9px] font-light text-[#22C55E]">610 remaining</span>
            </div>
          </div>
        </GlowCard>
      </ScrollReveal>

      {/* ── Row 3: Meals + (Water + Andi) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ScrollReveal delay={0.04} direction="up">
          <GlowCard glowColor="34,197,94">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide">MEALS</p>
                <Link href="/nutrition/log" className="font-caption text-[10px] font-light text-[var(--color-primary)]">+ Add</Link>
              </div>
              <div className="flex flex-col gap-2">
                {meals.map(m => (
                  <motion.div key={m.name} whileHover={{ x: 3 }} transition={{ duration: 0.15 }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-[10px] transition-colors ${m.logged ? "bg-[var(--color-success-light)]" : "bg-[var(--color-surface-2)]"}`}>
                    <div>
                      <p className="font-body font-bold text-[12px] text-[var(--color-text-1)]">{m.name}</p>
                      <p className="font-caption text-[9px] font-light text-[var(--color-text-3)]">{m.logged ? m.time : "Not logged"}</p>
                    </div>
                    {m.logged
                      ? <span className="font-metric text-[13px] text-[#22C55E]"><CountUp to={m.kcal} duration={1}/> kcal</span>
                      : <Link href="/nutrition" className="font-caption text-[10px] font-light text-[var(--color-primary)]">Log</Link>}
                  </motion.div>
                ))}
              </div>
            </div>
          </GlowCard>
        </ScrollReveal>

        <div className="flex flex-col gap-3">
          {/* Water */}
          <ScrollReveal delay={0.07} direction="up">
            <GlowCard glowColor="37,99,235">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-heading text-[.875rem] text-[var(--color-text-1)] tracking-wide">WATER</p>
                  <span className="font-metric text-[12px] text-[var(--color-primary)]">{waterLiters} / {waterGoal} L</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <ClickSpark key={i} color="#2563EB">
                      <motion.div
                        whileTap={{ scale: 0.82 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => setWaterCount(c => c === i + 1 ? i : i + 1)}
                        className={`w-6 h-8 rounded-[5px] border cursor-pointer transition-all ${i < waterCount ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "bg-[var(--color-surface-2)] border-[var(--color-border)]"}`}
                      />
                    </ClickSpark>
                  ))}
                </div>
                <ProgressBar value={(waterCount / 12) * 100} color="#2563EB" height={3} className="mt-2"/>
              </div>
            </GlowCard>
          </ScrollReveal>

          {/* Andi insight */}
          <ScrollReveal delay={0.1} direction="up">
            <GlowCard glowColor="37,99,235" className="border-[var(--color-primary-mid)]">
              <div className="p-4 bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-surface)] transition-colors">
                <div className="flex gap-3 items-start">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0 shadow-[0_0_0_4px_rgba(37,99,235,.15)]">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.25"/><path d="M7 4v3.5M7 9v.5" stroke="white" strokeWidth="1.25" strokeLinecap="round"/></svg>
                  </motion.div>
                  <div>
                    <p className="font-body font-bold text-[12px] text-[var(--color-primary)] mb-0.5">Andi</p>
                    <p className="font-body text-[12px] text-[var(--color-text-2)] leading-relaxed">
                      You&apos;re{" "}
                      <TextHighlight color="#2563EB" delay={0.6}>
                        <span className="text-[var(--color-primary)] font-bold">54g</span>
                      </TextHighlight>{" "}
                      short on protein. A chicken breast or shake post-workout closes the gap.
                    </p>
                  </div>
                </div>
              </div>
            </GlowCard>
          </ScrollReveal>
        </div>
      </div>

      <AnimatePresence>
        {whatsappPromptOpen && (
          <WhatsAppOptInModal onClose={() => setDismissedThisSession(true)} />
        )}
      </AnimatePresence>
    </div>
  );
}
