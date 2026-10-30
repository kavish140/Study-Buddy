import { z } from "zod";

const text = z.string().trim().min(1);
const schemas = {
  generateNotes: z.object({ summary: text }),
  parseSyllabus: z.object({
    subjects: z.array(z.object({ name: text, topics: z.array(text).min(1) })).min(1),
  }),
  generatePlan: z.object({
    plan: z
      .array(z.object({ day: z.number().int().min(1).max(31), tasks: z.array(text).min(1) }))
      .min(1),
  }),
};

export function validateAIResult(action: string, value: unknown): unknown {
  const schema = schemas[action as keyof typeof schemas];
  if (!schema) return value;
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "The AI returned an incomplete or invalid result. Please try again with a shorter topic or input.",
    );
  return parsed.data;
}
