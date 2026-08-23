"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV = [
  {
    label: "Home",
    href: "/dashboard",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 11.5L11 4l8 7.5V19H15v-5H9v5H3v-7.5z"
          stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "Nutrition",
    href: "/nutrition",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="7" stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75"/>
        <path d="M8 11a3 3 0 006 0" stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinecap="round"/>
        <circle cx="8.5" cy="9" r="1" fill={active ? "var(--color-primary)" : "var(--color-text-3)"}/>
        <circle cx="13.5" cy="9" r="1" fill={active ? "var(--color-primary)" : "var(--color-text-3)"}/>
      </svg>
    ),
  },
  {
    label: "Workouts",
    href: "/workouts",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M5 11h12M2 8h4M16 8h4M2 14h4M16 14h4"
          stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinecap="round"/>
        <rect x="2" y="6.5" width="4" height="9" rx="2" stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" fill="none"/>
        <rect x="16" y="6.5" width="4" height="9" rx="2" stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" fill="none"/>
      </svg>
    ),
  },
  {
    label: "Progress",
    href: "/progress",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 17L9 11l5 3 5-7" stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="11" r="1.5" fill={active ? "var(--color-primary)" : "var(--color-text-3)"}/>
        <circle cx="14" cy="14" r="1.5" fill={active ? "var(--color-primary)" : "var(--color-text-3)"}/>
      </svg>
    ),
  },
  {
    label: "Me",
    href: "/profile",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="3.5" stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75"/>
        <path d="M4 19c0-3.866 3.134-7 7-7h0c3.866 0 7 3.134 7 7" stroke={active ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] border-t border-[var(--color-border)] safe-bottom transition-colors duration-300">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {NAV.map(({ label, href, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 flex-1 py-2 focus-visible:outline-none relative"
              aria-label={label}
            >
              {active && (
                <motion.span
                  layoutId="bottom-active"
                  className="absolute top-1 inset-x-2 h-0.5 rounded-full bg-[var(--color-primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 36 }}
                />
              )}
              {icon(active)}
              <span className={cn(
                "font-caption text-[9px] font-light tracking-wide",
                active ? "text-[var(--color-primary)]" : "text-[var(--color-text-3)]",
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
