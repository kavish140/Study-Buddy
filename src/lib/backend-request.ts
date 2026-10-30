/** Bound stalled backend requests without discarding a recoverable session. */
export const BACKEND_UNAVAILABLE =
  "We couldn't connect to the service. It may be starting up. Please try again in a moment.";

export async function backendFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const timeout = AbortSignal.timeout(url.includes("/functions/v1/") ? 120_000 : 10_000);
  const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  return fetch(input, {
    ...init,
    signal: originalSignal ? AbortSignal.any([originalSignal, timeout]) : timeout,
  });
}
