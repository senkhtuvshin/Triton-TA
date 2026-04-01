"use client";
import { LogOut, UserCircle2, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function UserMenu() {
  const { user, signOut } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/8">
        <WifiOff size={12} className="text-white/25 shrink-0" />
        <span className="text-[11px] text-white/30 truncate">Local mode</span>
      </div>
    );
  }

  if (!user) return null;

  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-[#C69214]/25 border border-[#C69214]/40 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-[#E8B84B]">{initials}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/70 truncate leading-tight">{user.email}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Wifi size={9} className="text-green-400/70" />
          <span className="text-[9px] text-green-400/60 uppercase tracking-widest">Synced</span>
        </div>
      </div>

      <button
        onClick={signOut}
        className="shrink-0 text-white/20 hover:text-red-400/80 transition-colors opacity-0 group-hover:opacity-100"
        title="Sign out"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
