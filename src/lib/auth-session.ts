import type { SupabaseClient, Session } from "@supabase/supabase-js";

/** Observe SDK recovery without letting its retry loop hold the UI indefinitely. */
export function observeSession(
  auth: Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange">,
  options: {
    onSession: (session: Session | null) => void;
    onError: () => void;
    timeoutMs?: number;
  },
) {
  let active = true;
  let receivedEvent = false;
  const timer = setTimeout(() => {
    if (active) options.onError();
  }, options.timeoutMs ?? 8_000);
  const accept = (session: Session | null) => {
    if (!active) return;
    clearTimeout(timer);
    options.onSession(session);
  };
  const {
    data: { subscription },
  } = auth.onAuthStateChange((_event, session) => {
    receivedEvent = true;
    accept(session);
  });
  void auth
    .getSession()
    .then(({ data, error }) => {
      if (!active || receivedEvent) return;
      if (error) throw error;
      accept(data.session);
    })
    .catch(() => {
      if (!active || receivedEvent) return;
      clearTimeout(timer);
      options.onError();
    });
  return () => {
    active = false;
    clearTimeout(timer);
    subscription.unsubscribe();
  };
}
