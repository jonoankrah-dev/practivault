import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const { signIn, signUp, session } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Read industry from hash query string e.g. #/login?industry=plumber
  const industry = (() => {
    try {
      const hash = window.location.hash; // e.g. #/login?industry=plumber
      const qIndex = hash.indexOf("?");
      if (qIndex === -1) return null;
      return new URLSearchParams(hash.slice(qIndex + 1)).get("industry");
    } catch {
      return null;
    }
  })();

  // If there's an industry param, default to signup mode
  useEffect(() => {
    if (industry) setMode("signup");
  }, [industry]);

  useEffect(() => {
    if (!session) return;
    const email = session.user?.email ?? "";
    if (email.endsWith("@practivault-demo.app")) {
      void supabase.auth.signOut();
      return;
    }
    let cancelled = false;
    fetch("/api/me", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then((res) => {
      if (cancelled) return;
      if (res.ok) navigate("/dashboard");
      else void supabase.auth.signOut();
    });
    return () => {
      cancelled = true;
    };
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    if (mode === "signup") {
      const { error } = await signUp(email, password);
      setLoading(false);
      if (error) { setError(error); return; }

      // Try to sign in right away
      const si = await signIn(email, password);
      if (si.error) {
        setInfo("Account created. Please check your email to confirm before signing in.");
        setMode("signin");
      } else {
        // Save industry to user profile if we have it
        if (industry) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("users").update({ industry }).eq("id", user.id);
          }
        }
        navigate("/dashboard");
      }
      return;
    }
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8 text-primary">
          <Logo size={44} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">PractiVault</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Practice management for every trade
          </p>
        </div>

        {/* Industry badge — shown when coming from demo */}
        {industry && mode === "signup" && (
          <div className="mb-4 flex items-center gap-2 bg-[#E83A8E]/8 border border-[#E83A8E]/20 rounded-xl px-4 py-3">
            <span className="text-lg">
              {industry === "aesthetics" ? "🌿" :
               industry === "hair" ? "💇" :
               industry === "plumber" ? "🔧" :
               industry === "electrician" ? "⚡" :
               industry === "joiner" ? "🪵" :
               industry === "landscaper" ? "🌱" :
               industry === "cpd" ? "🎓" :
               industry === "health" ? "🏥" :
               industry === "builder" ? "🧱" : "🏢"}
            </span>
            <div>
              <p className="text-xs font-semibold text-[#E83A8E]">Your industry is pre-set</p>
              <p className="text-xs text-gray-500 capitalize">
                We'll personalise your account for {industry.replace(/-/g, " ")}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">{mode === "signin" ? "Sign in" : "Create your free account"}</h2>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-password"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm text-secondary bg-secondary/5 border border-secondary/20 rounded-md px-3 py-2">
              {info}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loading}
            data-testid="button-signin"
          >
            {loading
              ? (mode === "signin" ? "Signing in…" : "Creating account…")
              : mode === "signin" ? "Sign in" : "Start free trial"}
          </Button>

          <p className="text-xs text-muted-foreground text-center pt-1">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button type="button" onClick={() => { setMode("signup"); setError(null); setInfo(null); }} className="text-primary hover:underline font-medium">
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => { setMode("signin"); setError(null); setInfo(null); }} className="text-primary hover:underline font-medium">
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
