"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function Field({
  label, type = "text", placeholder, value, onChange, show, onToggle,
}: {
  label: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  show?: boolean; onToggle?: () => void;
}) {
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-caption text-[11px] font-light text-white/50 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-12 w-full rounded-[12px] bg-white/8 border border-white/12 px-4 font-body text-[14px] text-white placeholder:text-white/25
            focus:outline-none focus:border-[#2563EB] focus:bg-white/12 focus:shadow-[0_0_0_3px_rgba(37,99,235,.18)]
            transition-all duration-200"
        />
        {isPassword && onToggle && (
          <button type="button" onClick={onToggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
            {show
              ? <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 8.5s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8.5" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              : <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 8.5s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8.5" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.4"/></svg>
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!firstName.trim() || !lastName.trim()) return setError("Please enter your full name.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8)  return setError("Password must be at least 8 characters.");
    if (password !== confirm)  return setError("Passwords do not match.");
    
    setLoading(true);
    
    try {
      const supabase = createClient();
      
      // Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        console.log('Signup successful:', data.user?.email);
        // Redirect to onboarding
        router.push("/onboarding");
        router.refresh();
      } else if (data.user && !data.session) {
        // Email confirmation required
        setError("Please check your email to confirm your account.");
        setLoading(false);
      }
    } catch (err) {
      console.error('Signup error:', err);
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
        <h1 className="font-heading text-[2rem] md:text-[2.25rem] text-white tracking-wide mb-1">CREATE ACCOUNT</h1>
        <p className="font-caption text-[12px] font-light text-white/35 mb-8">Start your transformation today.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 mb-3">
        <Field label="First Name" placeholder="Arjun"  value={firstName} onChange={setFirstName}/>
        <Field label="Last Name"  placeholder="Sharma" value={lastName}  onChange={setLastName}/>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-3">
        <Field label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail}/>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-3">
        <Field label="Password" type="password" placeholder="Min. 8 characters"
          value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw(v => !v)}/>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-4">
        <Field label="Confirm Password" type="password" placeholder="Repeat password"
          value={confirm} onChange={setConfirm} show={showCf} onToggle={() => setShowCf(v => !v)}/>
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="font-caption text-[11px] text-[#EF4444] mb-4 px-1"
        >{error}</motion.p>
      )}

      <motion.div variants={fadeUp}>
        <p className="font-caption text-[10px] font-light text-white/25 mb-6 leading-relaxed">
          By signing up you agree to our{" "}
          <span className="text-[#2563EB] cursor-pointer">Terms of Service</span> and{" "}
          <span className="text-[#2563EB] cursor-pointer">Privacy Policy</span>.
        </p>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="h-13 w-full rounded-[13px] bg-[#2563EB] text-white font-body font-bold text-[15px]
            flex items-center justify-center gap-2
            shadow-[0_4px_24px_rgba(37,99,235,.35)]
            hover:bg-[#1D4ED8] hover:shadow-[0_8px_32px_rgba(37,99,235,.5)]
            active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed
            transition-all duration-200"
          style={{ height: 52 }}
        >
          {loading
            ? <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="white" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
            : "Create Account"
          }
        </button>

        <p className="text-center font-caption text-[11px] font-light text-white/35 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-[#2563EB] hover:text-[#60A5FA] transition-colors">Sign in</Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
