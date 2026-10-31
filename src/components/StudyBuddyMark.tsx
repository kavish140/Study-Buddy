import { cn } from "@/lib/utils";

/** Decorative brand mark; the surrounding wordmark or link supplies its name. */
export function StudyBuddyMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      width={64}
      height={64}
      className={cn("block shrink-0 text-primary", className)}
    >
      {/* Geometry matches the standalone SVG; currentColor follows the site's accent. */}
      <rect width="64" height="64" rx="18" fill="currentColor" />
      <circle cx="23" cy="20" r="5" fill="white" />
      <circle cx="41" cy="20" r="5" fill="white" fillOpacity=".8" />
      <path
        d="M14 30a2 2 0 0 1 2-2c6.6 0 11.6 2.3 16 6.3V51c-4.4-4-9.4-6.3-16-6.3a2 2 0 0 1-2-2V30Z"
        fill="white"
      />
      <path
        d="M50 30a2 2 0 0 0-2-2c-6.6 0-11.6 2.3-16 6.3V51c4.4-4 9.4-6.3 16-6.3a2 2 0 0 0 2-2V30Z"
        fill="white"
        fillOpacity=".8"
      />
      <path d="M32 35v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
