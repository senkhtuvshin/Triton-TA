"use client";
import { useState } from "react";
import { Loader2, GraduationCap, Mail, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function AuthModal() {
  const { signIn, signUp } = useAuth();
  const [tab,      setTab]      = useState<"signin" | "signup">("signin");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  if (!isSupabaseConfigured) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = tab === "signin"
      ? await signIn(email, password)
      : await signUp(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else if (tab === "signup") {
      setSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1D30]/90 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-[#C69214]/30 bg-[#182B49] shadow-2xl shadow-black/50 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#182B49] to-[#1F3A63] px-6 pt-6 pb-4 border-b border-[#C69214]/20">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#C69214]/20 flex items-center justify-center">
              <GraduationCap size={18} className="text-[#E8B84B]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">UCSD Course Agent</h1>
              <p className="text-white/40 text-xs">Sync your progress across devices</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setSuccess(false); }}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                tab === t
                  ? "text-[#E8B84B] border-b-2 border-[#C69214]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <p className="text-green-400 text-sm font-medium">Account created!</p>
              <p className="text-white/50 text-xs mt-1">Check your email to confirm, then sign in.</p>
              <button
                onClick={() => { setTab("signin"); setSuccess(false); }}
                className="mt-4 text-[#C69214] text-sm underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@ucsd.edu" required
                    className="w-full bg-white/5 border border-white/15 text-white/90 placeholder:text-white/25 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C69214]/40 focus:border-[#C69214]/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6}
                    className="w-full bg-white/5 border border-white/15 text-white/90 placeholder:text-white/25 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C69214]/40 focus:border-[#C69214]/50"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#C69214] to-[#E8B84B] text-[#0F1D30] font-bold text-sm hover:from-[#E8B84B] hover:to-[#C69214] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {tab === "signin" ? "Sign In" : "Create Account"}
              </button>

              <p className="text-center text-white/25 text-xs">
                Your data syncs across all your devices via Supabase.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
