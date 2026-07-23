/**
 * date-utils.ts — IST (Asia/Kolkata, UTC+5:30) aware date helpers.
 *
 * All "today" / "date key" logic in the app must use these helpers so that
 * the day boundary is always midnight IST, not midnight UTC.  Using
 * `new Date().toISOString().split("T")[0]` gives a UTC date which is 5 h 30 m
 * behind IST and will return the *previous* day during the first 5.5 hours of
 * the Indian day (00:00–05:29 IST).
 */

const IST_LOCALE = "en-IN";
const IST_TZ = "Asia/Kolkata";

/**
 * Returns today's date as a YYYY-MM-DD string in IST.
 * Use this everywhere you previously used `new Date().toISOString().split("T")[0]`.
 */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST_TZ }); // en-CA gives YYYY-MM-DD
}

/**
 * Returns yesterday's date as a YYYY-MM-DD string in IST.
 */
export function yesterdayIST(): string {
  const todayStr = todayIST();
  // Pin to IST midnight so arithmetic works correctly regardless of the user's system timezone
  const d = new Date(todayStr + "T00:00:00+05:30");
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: IST_TZ });
}

/**
 * Returns the current hour (0–23) in IST.
 * Use this instead of `new Date().getHours()` for time-of-day checks.
 */
export function currentHourIST(): number {
  return Number(
    new Date().toLocaleString("en-US", { timeZone: IST_TZ, hour: "numeric", hour12: false }),
  );
}

/**
 * Formats a YYYY-MM-DD date string for human-readable display in IST.
 * Parses as local midnight so the displayed date is always correct.
 *
 * @param dateStr  YYYY-MM-DD string (e.g. "2026-07-14")
 * @param options  Intl.DateTimeFormat options (defaults to "14 July 2026" style)
 */
export function formatDateIST(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  // Pin to IST midnight (+05:30) so the date is always correct regardless of the user's
  // system timezone. Using "T00:00:00" (no offset) would parse as local midnight, which
  // shifts the displayed date by ±1 day for users east/west of IST.
  return new Date(dateStr + "T00:00:00+05:30").toLocaleDateString(IST_LOCALE, {
    ...options,
    timeZone: IST_TZ,
  });
}

/**
 * Formats a full ISO timestamp (e.g. from Supabase `created_at`) for display in IST.
 */
export function formatTimestampIST(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return new Date(iso).toLocaleDateString(IST_LOCALE, { ...options, timeZone: IST_TZ });
}

/**
 * Formats a time portion of an ISO timestamp in IST (e.g. "02:30 PM").
 */
export function formatTimeIST(iso: string): string {
  return new Date(iso).toLocaleTimeString(IST_LOCALE, {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Computes days remaining until a YYYY-MM-DD exam date, using IST day boundaries.
 * Returns null if dateStr is falsy; 0 if the exam is today or in the past.
 */
export function daysUntilIST(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  // Pin both dates to IST midnight to avoid timezone-dependent off-by-one.
  const target = new Date(dateStr + "T00:00:00+05:30").getTime();
  const todayMidnight = new Date(todayIST() + "T00:00:00+05:30").getTime();
  return Math.max(0, Math.ceil((target - todayMidnight) / (1000 * 60 * 60 * 24)));
}

/**
 * Returns the minimum date string for a date-picker (today in IST).
 * Use as: `<input type="date" min={minDateIST()} />`
 */
export function minDateIST(): string {
  return todayIST();
}
