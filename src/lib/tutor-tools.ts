export const TUTOR_TOOLS = {
  quiz: { path: "/quiz", label: "Open quiz" },
  pyq: { path: "/pyq", label: "Open question bank" },
  notes: { path: "/notes", label: "Open notes & flashcards" },
  mock_test: { path: "/mock-test", label: "Open mock tests" },
  planner: { path: "/planner", label: "Open study planner" },
  focus: { path: "/focus", label: "Open focus timer" },
  review: { path: "/review", label: "Open due reviews" },
  analytics: { path: "/analytics", label: "Open performance analytics" },
  syllabus: { path: "/syllabus", label: "Open syllabus" },
  teach: { path: "/teach", label: "Open teach-back mode" },
  sources: { path: "/sources", label: "Open study resources" },
} as const;

export type TutorToolAction = { tool: keyof typeof TUTOR_TOOLS; topic?: string };

/** Only local, known tools can become controls. Never accept model-provided URLs. */
export function parseTutorTools(content: string): { content: string; actions: TutorToolAction[] } {
  const marker = /(?:^|\n)[ \t]*```tutor-tools\b[^\n]*\n?/i.exec(content);
  if (!marker) return { content, actions: [] };
  const start = marker.index + marker[0].length;
  const end = content.indexOf("```", start);
  const visible = content.slice(0, marker.index).trimEnd();
  if (end < 0) return { content: visible, actions: [] };
  const cleaned = visible + content.slice(end + 3);
  try {
    const value: unknown = JSON.parse(content.slice(start, end));
    if (!Array.isArray(value) || value.length > 3) return { content: cleaned, actions: [] };
    const actions: TutorToolAction[] = [];
    for (const action of value) {
      if (
        !action ||
        typeof action !== "object" ||
        typeof action.tool !== "string" ||
        !Object.hasOwn(TUTOR_TOOLS, action.tool) ||
        (action.topic !== undefined &&
          (typeof action.topic !== "string" || action.topic.length > 200))
      )
        continue;
      if (!actions.some((existing) => existing.tool === action.tool)) {
        actions.push({ tool: action.tool, topic: action.topic?.trim() || undefined });
      }
    }
    return { content: cleaned, actions };
  } catch {
    return { content: cleaned, actions: [] };
  }
}

export function tutorToolTarget(action: TutorToolAction): {
  to: (typeof TUTOR_TOOLS)[TutorToolAction["tool"]]["path"];
  search: { topic?: string };
} {
  return {
    to: TUTOR_TOOLS[action.tool].path,
    search:
      action.topic && ["quiz", "notes", "pyq"].includes(action.tool) ? { topic: action.topic } : {},
  };
}
