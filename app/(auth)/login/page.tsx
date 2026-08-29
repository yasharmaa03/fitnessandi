"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]       = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (!password)             return setError("Enter your password.");
    
    setLoading(true);
    
    try {
      const supabase = createClient();
      
      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        console.log('Login successful:', data.user?.email);
        // Redirect to dashboard
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error('Login error:', err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="w-full">
      <motion.div variants={fadeUp}>
        <Link href="/" className="inline-flex items-center gap-2 mb-8 text-white/30 hover:text-white/60 transition-colors md:hidden">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="font-caption text-[11px] font-light uppercase tracking-wider">Back</span>
        </Link>
        <h1 className="font-heading text-[2rem] md:text-[2.25rem] text-white tracking-wide mb-1">WELCOME BACK</h1>
        <p className="font-caption text-[12px] font-light text-white/35 mb-8">Sign in to continue your journey.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-3">
        <label className="font-caption text-[11px] font-light text-white/50 uppercase tracking-wider block mb-1.5">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="h-12 w-full rounded-[12px] bg-white/8 border border-white/12 px-4 font-body text-[14px] text-white placeholder:text-white/25
            focus:outline-none focus:border-[#2563EB] focus:bg-white/12 focus:shadow-[0_0_0_3px_rgba(37,99,235,.18)] transition-all duration-200"
        />
      </motion.div>

      <motion.div variants={fadeUp} className="mb-2">
        <label className="font-caption text-[11px] font-light text-white/50 uppercase tracking-wider block mb-1.5">Password</label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="h-12 w-full rounded-[12px] bg-white/8 border border-white/12 px-4 pr-12 font-body text-[14px] text-white placeholder:text-white/25
              focus:outline-none focus:border-[#2563EB] focus:bg-white/12 focus:shadow-[0_0_0_3px_rgba(37,99,235,.18)] transition-all duration-200"
          />
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
            {show
              ? <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 8.5s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8.5" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              : <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 8.5s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8.5" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.4"/></svg>
            }
          </button>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="flex justify-end mb-5">
        <Link href="/forgot-password" className="font-caption text-[11px] font-light text-[#2563EB] hover:text-[#60A5FA] transition-colors">
          Forgot password?
        </Link>
      </motion.div>

      {error && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="font-caption text-[11px] text-[#EF4444] mb-4 px-1">{error}
        </motion.p>
      )}

      <motion.div variants={fadeUp}>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-[13px] bg-[#2563EB] text-white font-body font-bold text-[15px]
            flex items-center justify-center gap-2
            shadow-[0_4px_24px_rgba(37,99,235,.35)]
            hover:bg-[#1D4ED8] hover:shadow-[0_8px_32px_rgba(37,99,235,.5)]
            active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed
            transition-all duration-200"
          style={{ height: 52 }}
        >
          {loading
            ? <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="white" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
            : "Sign In"
          }
        </button>

        <p className="text-center font-caption text-[11px] font-light text-white/35 mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#2563EB] hover:text-[#60A5FA] transition-colors">Sign up</Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
