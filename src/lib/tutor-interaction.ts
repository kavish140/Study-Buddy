export type TutorCheckpoint = { question: string; options: string[] };

/** Keep streaming protocol fragments out of markdown; tolerate older plain-text replies. */
export function parseTutorResponse(content: string): {
  content: string;
  checkpoint: TutorCheckpoint | null;
} {
  const marker = /(?:^|\n)[ \t]*```tutor\b[^\n]*\n?/i.exec(content);
  if (!marker) return { content, checkpoint: null };
  const teaching = content.slice(0, marker.index).trimEnd();
  const rest = content.slice(marker.index + marker[0].length);
  const end = rest.indexOf("```");
  if (end < 0) return { content: teaching, checkpoint: null };
  try {
    const value: unknown = JSON.parse(rest.slice(0, end).trim());
    if (!value || typeof value !== "object") throw new Error("Invalid checkpoint");
    const { question, options } = value as Record<string, unknown>;
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 1000 ||
      !Array.isArray(options) ||
      options.length > 4 ||
      !options.every(
        (option) => typeof option === "string" && option.trim() && option.length <= 300,
      )
    ) {
      throw new Error("Invalid checkpoint");
    }
    return {
      content: teaching,
      checkpoint: { question: question.trim(), options: [...new Set(options as string[])] },
    };
  } catch {
    // Invalid model output stays readable and never becomes an actionable control.
    return {
      content: [teaching, "Continue with your answer, or ask for a hint."]
        .filter(Boolean)
        .join("\n\n"),
      checkpoint: null,
    };
  }
}
