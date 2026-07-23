/**
 * Builds a rich app-context summary string that gets injected into AI system prompts.
 * This gives every AI feature (chat, quiz, notes, mock tests, teach mode) full awareness
 * of the student's current state: syllabus progress, today's study plan, XP, streak, etc.
 */
import type { Subject, PlanItem, UserStats, UserProfile } from "./storage";
import { todayIST } from "./date-utils";

export interface AppContext {
  examName?: string;
  targetDate?: string | null;
  displayName?: string;
  /** Syllabus subjects with completion % */
  subjects?: Subject[];
  /** Today's plan tasks */
  todayTasks?: PlanItem[];
  /** Gamification stats */
  xp?: number;
  level?: number;
  streak?: number;
}

/**
 * Serializes AppContext into a compact string suitable for injecting into an AI system prompt.
 * Returns an empty string if no meaningful context is available.
 */
export function buildContextSummary(ctx: AppContext): string {
  const parts: string[] = [];

  if (ctx.displayName) {
    parts.push(`Student name: ${ctx.displayName}`);
  }

  if (ctx.examName) {
    parts.push(`Exam: ${ctx.examName}`);
  }

  if (ctx.targetDate) {
    const today = new Date(todayIST() + "T00:00:00+05:30");
    const target = new Date(ctx.targetDate + "T00:00:00+05:30");
    const daysLeft = Math.ceil((target.getTime() - today.getTime()) / 86400000);
    if (daysLeft > 0) {
      parts.push(`Exam date: ${ctx.targetDate} (${daysLeft} days left)`);
    }
  }

  // Syllabus progress
  if (ctx.subjects && ctx.subjects.length > 0) {
    const subSummaries = ctx.subjects.map((s) => {
      const total = s.topics.length;
      const done = s.topics.filter((t) => t.done).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return `${s.name}: ${done}/${total} topics (${pct}%)`;
    });
    parts.push(`Syllabus progress:\n${subSummaries.join("\n")}`);
  }

  // Today's plan
  if (ctx.todayTasks && ctx.todayTasks.length > 0) {
    const done = ctx.todayTasks.filter((t) => t.done);
    const pending = ctx.todayTasks.filter((t) => !t.done);
    let planStr = `Today's study plan: ${done.length}/${ctx.todayTasks.length} tasks done`;
    if (pending.length > 0) {
      planStr += `\nPending today: ${pending.map((t) => t.task).join("; ")}`;
    }
    parts.push(planStr);
  }

  // Gamification
  if (ctx.xp !== undefined || ctx.streak !== undefined) {
    const stats: string[] = [];
    if (ctx.xp !== undefined) stats.push(`${ctx.xp} XP`);
    if (ctx.level !== undefined) stats.push(`Level ${ctx.level}`);
    if (ctx.streak !== undefined && ctx.streak > 0) stats.push(`${ctx.streak}-day streak`);
    parts.push(`Student stats: ${stats.join(", ")}`);
  }

  return parts.length > 0
    ? `\n\n--- STUDENT CONTEXT ---\n${parts.join("\n")}\n--- END CONTEXT ---`
    : "";
}
