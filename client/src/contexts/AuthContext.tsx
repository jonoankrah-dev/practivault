import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setAuthToken, setOnUnauthorized, queryClient } from "@/lib/queryClient";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOnUnauthorized(() => {
      void supabase.auth.signOut();
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      const { data: sessionData } = await supabase.auth.getSession();
      let active = sessionData.session;
      if (active) {
        const { data: userData, error } = await supabase.auth.getUser();
        if (error || !userData.user) {
          await supabase.auth.signOut();
          active = null;
        }
      }
      if (cancelled) return;
      setSession(active);
      setAuthToken(active?.access_token ?? null);
      setLoading(false);
    }

    void initSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthToken(newSession?.access_token ?? null);
      queryClient.invalidateQueries();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
