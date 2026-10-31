export const LEGAL_PATHS = ["/privacy", "/terms", "/sources"];
export const LEGAL_UPDATED = "31 October 2026";
export const OPERATOR_NAME = "Kavish Ganatra";
export const CONTACT_EMAIL = "kavishganatra5@gmail.com";

// Earlier saved attempts/cards embedded credits in their answer text. Hide only
// the known importer-generated suffixes; preserve the stored text and provenance.
export function withoutInlineCredit(text = "") {
  return text
    .replace(
      /\n\nSource: \[(?:JEEBench[^\]]*|Physics Wallah[^\]]*)\]\(https:\/\/huggingface\.co\/datasets\/[^\s)]+\)\s*$/i,
      "",
    )
    .replace(/\. Source: (?:JEEBench|Physics Wallah)[^\n]*\.?\s*$/i, ".")
    .replace(/^(Source answer key: [\s\S]*?)\. (?:JEEBench|Physics Wallah)[^\n]*\s*$/i, "$1.");
}
