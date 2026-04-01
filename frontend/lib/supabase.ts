import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Returns null when Supabase env vars are not set (local-only mode).
 * The rest of the app checks for null before calling Supabase methods.
 */
export const supabase = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon)
  : null;

export const isSupabaseConfigured = !!supabase;
