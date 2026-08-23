"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/store/user";

const NAV = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 10L10 4l7 6v8H13v-5H7v5H3v-8z" stroke={a ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "Nutrition",
    href: "/nutrition",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="6" stroke={a ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75"/>
        <path d="M7 10a3 3 0 006 0" stroke={a ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Workouts",
    href: "/workouts",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 10h12M2 7h4M14 7h4M2 13h4M14 13h4" stroke={a ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinecap="round"/>
        <rect x="2" y="5.5" width="4" height="9" rx="2" stroke={a ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" fill="none"/>
        <rect x="14" y="5.5" width="4" height="9" rx="2" stroke={a ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" fill="none"/>
      </svg>
    ),
  },
  {
    label: "Progress",
    href: "/progress",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 15L8 9l5 3 5-7" stroke={a ? "var(--color-primary)" : "var(--color-text-3)"} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="8" cy="9" r="1.5" fill={a ? "var(--color-primary)" : "var(--color-text-3)"}/>
        <circle cx="13" cy="12" r="1.5" fill={a ? "var(--color-primary)" : "var(--color-text-3)"}/>
      </svg>
    ),
  },
];

export default function SideNav() {
  const pathname = usePathname();
  const { avatar, firstName, isDark, toggleDark } = useUserStore();

  return (
    <aside className="hidden lg:flex flex-col w-60 xl:w-64 flex-shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] h-full sticky top-0 transition-colors duration-300">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-[#2563EB] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M1 6h4M11 6h4M1 10h4M11 10h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="1" y="4.5" width="4" height="7" rx="2" stroke="white" strokeWidth="1.5" fill="none"/>
              <rect x="11" y="4.5" width="4" height="7" rx="2" stroke="white" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <span className="font-display text-[1.0625rem] text-[var(--color-text-1)] tracking-wide transition-colors">FITNESSANDI</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] group transition-colors hover:bg-[var(--color-surface-2)]">
              {active && (
                <motion.span
                  layoutId="side-active"
                  className="absolute inset-0 bg-[var(--color-primary-light)] rounded-[10px]"
                  transition={{ type: "spring", stiffness: 400, damping: 36 }}
                />
              )}
              <span className="relative z-10">{icon(active)}</span>
              <span className={cn(
                "relative z-10 font-body font-bold text-[13px]",
                active ? "text-[var(--color-primary)]" : "text-[var(--color-text-2)] group-hover:text-[var(--color-text-1)]"
              )}>
                {label}
              </span>
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-primary)] rounded-full"/>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Dark mode toggle */}
      <div className="px-4 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={toggleDark}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[var(--color-surface-2)] transition-colors group"
        >
          <motion.span animate={{ rotate: isDark ? 0 : 15 }} transition={{ duration: 0.4, ease: "easeInOut" }}>
            {isDark ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3.5" stroke="#FCD34D" strokeWidth="1.75"/>
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="#FCD34D" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M17.5 10.5a7.5 7.5 0 01-9.5-9.5 7.5 7.5 0 109.5 9.5z" stroke="var(--color-text-3)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </motion.span>
          <span className="font-body font-bold text-[13px] text-[var(--color-text-2)] group-hover:text-[var(--color-text-1)] transition-colors">
            {isDark ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>

      {/* Profile footer */}
      <div className="px-4 py-4 border-t border-[var(--color-border)]">
        <Link href="/profile" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-primary)] flex items-center justify-center">
            <span className="font-heading text-[11px] text-[var(--color-primary)]">{avatar || "U"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body font-bold text-[12px] text-[var(--color-text-1)] truncate transition-colors">{firstName || "Profile"}</p>
            <p className="font-caption text-[10px] font-light text-[var(--color-text-3)]">View profile</p>
          </div>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1l4 4-4 4" stroke="var(--color-text-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </div>
    </aside>
  );
}
