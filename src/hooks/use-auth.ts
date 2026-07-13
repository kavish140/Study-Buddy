import { useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Track whether the initial getSession call has already resolved so that
  // the onAuthStateChange listener doesn't race with it and cause a flicker.
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // Seed initial state from the persisted session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // If this fires before getSession resolves (race), it becomes the
      // authoritative initial load result; mark it done so getSession skips.
      initialLoadDone.current = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error("Error signing in with Google:", error.message);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error.message);
      throw error;
    }
  };

  return { session, user, loading, signInWithGoogle, signOut };
}
