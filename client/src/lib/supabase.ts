import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// NOTE: we disable localStorage/cookie session persistence because the sandbox
// iframe blocks storage APIs. Session is kept in-memory inside AuthContext only.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  },
});
