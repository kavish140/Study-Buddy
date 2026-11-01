/** Use at UI boundaries; preserve actionable errors while hiding transport jargon. */
export function userErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  const value =
    error && typeof error === "object"
      ? (error as { message?: unknown; status?: unknown; code?: unknown; name?: unknown })
      : {};
  if (value.status === 401 || value.code === "PGRST301" || value.code === "refresh_token_not_found")
    return "Your session expired. Please sign in again.";
  if (value.status === 429) return "Usage limit reached. Please wait a moment and try again.";
  if (value.name === "TimeoutError" || value.name === "AbortError")
    return "The request timed out. Please try again.";
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return "You're offline. Check your connection and try again.";
  if (typeof value.message !== "string" || !value.message.trim()) return fallback;
  if (
    /failed to fetch|fetch failed|networkerror|functionsfetcherror|failed to send a request|load failed/i.test(
      value.message,
    )
  )
    return "We couldn't connect to the service. Check your connection and try again.";
  if (/JWT|refresh.token|not authenticated|authentication required/i.test(value.message))
    return "Your session expired. Please sign in again.";
  return value.message;
}
