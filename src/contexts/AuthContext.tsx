import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { checkAuthService, supabase } from "@/lib/supabase";
import { BACKEND_UNAVAILABLE } from "@/lib/backend-request";
import { observeSession } from "@/lib/auth-session";
import { setQuestionHistoryUser } from "@/lib/question-bank";

type AuthState = { session: Session | null; loading: boolean; error: string | null };
type AuthValue = AuthState & {
  user: Session["user"] | null;
  retry: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const previousUserId = useRef<string | null>(null);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    return observeSession(supabase.auth, {
      onSession: (session) => {
        const userId = session?.user.id ?? null;
        setQuestionHistoryUser(
          userId,
          userId
            ? {
                reserve: async (groups, legacyIds) => {
                  const { data, error } = await supabase.rpc("reserve_question_groups", {
                    p_groups: groups,
                    p_legacy_ids: legacyIds,
                  });
                  if (error)
                    throw new Error(
                      error.message || "Question history could not sync. Please try again.",
                    );
                  return data;
                },
                reset: async () => {
                  const { error } = await supabase.rpc("reset_question_history");
                  if (error) throw new Error("Question history could not reset. Please try again.");
                },
              }
            : null,
        );
        if (previousUserId.current !== userId) {
          queryClient.clear();
          previousUserId.current = userId;
        }
        setState({ session, loading: false, error: null });
      },
      onError: () =>
        setState((current) => ({ ...current, loading: false, error: BACKEND_UNAVAILABLE })),
    });
  }, [attempt, queryClient]);

  const signInWithGoogle = async () => {
    await checkAuthService();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error("Unable to start Google sign-in. Please try again.");
    window.location.assign(data.url);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ ...state, user: state.session?.user ?? null, retry, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
