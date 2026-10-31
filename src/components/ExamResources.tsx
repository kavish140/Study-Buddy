import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { RESOURCE_REVIEW_DATE, resourcesForExam } from "@/lib/exam-resources";

const labels = {
  "study-material": "Study material",
  "question-bank": "Question bank / practice",
  "past-paper": "Previous-year paper",
  "answer-key": "Answer key",
};
const access = {
  free: "Free",
  "free-account": "Free · account required",
  mixed: "Free and paid options",
};

export function ExamResources({ examId }: { examId: string }) {
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const resources = resourcesForExam(examId);
  if (!resources.length) return null;
  const filtered = resources.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      `${r.title} ${r.publisher} ${r.subjects.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  return (
    <section
      className="card-light rounded-2xl p-5 space-y-4 mt-6"
      aria-label="Study materials and external question banks"
    >
      <div>
        <h4 className="text-xl font-semibold">Study materials & official practice</h4>
        <p className="text-sm text-muted-foreground mt-1">
          {resources.length} {resources.length === 1 ? "resource" : "resources"} from exam publishers and public education institutions. These
          open on the publisher’s site; their questions are not imported into AcePrep quizzes.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Sources reviewed {RESOURCE_REVIEW_DATE}. Access and availability may change.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search study resources"
          placeholder="Search publisher, subject or material…"
          className="min-w-0 flex-1 rounded-lg border p-2 bg-background"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Resource type"
          className="rounded-lg border p-2 bg-background"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">All resource types</option>
          {Object.entries(labels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((r) => (
          <article key={r.id} className="border rounded-xl p-4 space-y-2 min-w-0">
            <p className="text-xs text-muted-foreground">
              {labels[r.kind]} · {r.format.toUpperCase()} · {access[r.access]}
            </p>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary underline inline-flex items-start gap-2"
            >
              {r.title}
              <ExternalLink className="h-4 w-4 shrink-0 mt-1" aria-hidden="true" />
            </a>
            <p className="text-xs font-medium">
              {r.publisher} · {r.subjects.join(", ")}
            </p>
            <p className="text-sm text-muted-foreground">{r.description}</p>
            <a
              href={r.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
            >
              Publisher source / listing
            </a>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p role="status" className="text-sm text-muted-foreground">
          No resources match. Clear your search or choose another resource type.
        </p>
      )}
      <a
        className="text-xs text-primary underline"
        href="/study-resources.json"
        target="_blank"
        rel="noreferrer"
      >
        Download source catalog (JSON)
      </a>
    </section>
  );
}
