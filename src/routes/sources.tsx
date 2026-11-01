import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { ExamResources } from "@/components/ExamResources";
import { EXAM_CATALOG } from "@/lib/exam-catalog";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Sources & Licenses — Study Buddy" },
      {
        name: "description",
        content:
          "Question-bank attribution, third-party license notices, external study resources and copyright contact.",
      },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  return (
    <LegalPage title="Sources & Licenses">
      <section>
        <h2>Question-bank attribution</h2>
        <p>
          Credits are collected on this page to keep practice focused. Individual records retain
          their source identifiers, available exam year, provenance and license metadata in the
          underlying data. Dataset license labels are the upstream publishers' declarations; they do
          not establish ownership of every underlying exam question or trademark.
        </p>
        <ul>
          <li>
            <a href="https://practice4u.vercel.app/" target="_blank" rel="noreferrer">
              Practice4U — practice collection
            </a>{" "}
            — copyright Practice4U, all rights reserved. Imported into JEE Main, JEE Advanced and
            NEET practice from a captured collection. Source keys and solutions are retained; paper
            provenance and whole-bank correctness are unverified. These records are labeled practice
            rather than verified previous-year questions.
          </li>
          <li>
            <a
              href="https://huggingface.co/datasets/Kshitij-PES/NEET_Dataset"
              target="_blank"
              rel="noreferrer"
            >
              Kshitij Gupta — NEET UG question collection
            </a>{" "}
            — upstream license:{" "}
            <a href="/question-bank/LICENSE-Apache-2.0.txt">Apache License 2.0</a>. Used for a
            partial 2021–2024 Physics, Chemistry and Biology bank. Source-supplied keys have not
            been independently checked against every NTA booklet. Study notes, ambiguous 2025/mock
            records and missing diagrams are excluded; generated source explanations are omitted.
          </li>
          <li>
            <a
              href="https://huggingface.co/datasets/daman1209arora/jeebench"
              target="_blank"
              rel="noreferrer"
            >
              JEEBench
            </a>{" "}
            — Daman Arora, Himanshu Singh and Mausam, DAIR Group, IIT Delhi. Copyright (c) 2023 Data
            Analytics and Intelligence Research (DAIR) Group, IIT Delhi. Distributed under the{" "}
            <a href="/question-bank/LICENSE-JEEBench.txt">
              MIT license, including its complete permission and warranty notice
            </a>
            . Used for JEE Advanced questions.
          </li>
          <li>
            <a
              href="https://huggingface.co/datasets/PhysicsWallahAI/JEE-Main-2025-Math"
              target="_blank"
              rel="noreferrer"
            >
              Physics Wallah AI Research — JEE Main 2025 Mathematics Evaluation Set
            </a>
            . Upstream license:{" "}
            <a href="/question-bank/LICENSE-Apache-2.0.txt">Apache License 2.0</a>. Used for JEE
            Main mathematics questions.
          </li>
        </ul>
        <p>
          Import changes include formatting normalization, separating choices, converting supported
          tables, deduplication and excluding incomplete or diagram-dependent entries. Source answer
          keys are retained. Importing does not generate questions or answers with AI. The available
          bank is not a complete exam archive.
        </p>
        <p>
          <a href="/question-bank/NOTICE.md">Full attribution notice</a> ·{" "}
          <a href="/question-bank/manifest.json">Import manifest, pinned revisions and checksums</a>
        </p>
        <p>
          The eQOURSE / soughed JEE Main community collection is held for review and excluded from
          the shipped bank. Its upstream card declares CC BY 4.0. This reference documents an
          evaluated source and does not indicate that its questions are available in practice.
        </p>
      </section>
      <section id="resources">
        <h2>External study materials and practice sources</h2>
        <p>
          The catalog below links to CBSE, NTA, NCERT, IIT Kanpur SATHEE, UPSC, College Board and
          ETS resources. These materials open on the publisher's site; their inclusion does not mean
          their content has been imported into Study Buddy. External sites retain their own terms,
          access requirements and content rights. No affiliation or endorsement is implied.
        </p>
        {EXAM_CATALOG.map((exam) => (
          <div key={exam.id} id={exam.id} className="mt-6">
            <h3 className="font-semibold text-lg">{exam.name}</h3>
            <ExamResources examId={exam.id} />
          </div>
        ))}
      </section>
      <section>
        <h2>Copyright and corrections</h2>
        <p>
          If you believe material infringes your rights or contains an error, contact the operator
          below with the page or question identifier, a description of the issue, relevant ownership
          or answer-key evidence, and a way to reach you. Reports will be reviewed and affected
          material may be corrected, restricted or removed as appropriate. These notices do not
          grant additional rights beyond each applicable license.
        </p>
      </section>
    </LegalPage>
  );
}
