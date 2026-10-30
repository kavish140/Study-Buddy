# Sourced question bank

New quiz, mock, diagnostic, PYQ-practice and note-card questions come from static
question-bank snapshots. They never call Groq or Gemini to write questions. AI
remains available for summaries, syllabus parsing, schedules, explaining supplied
questions and evaluating students' explanations. The old Edge Function question
creation actions return HTTP 410. Existing study history is retained; older
unattributed quizzes cannot be retaken as new bank quizzes.

Question selection reserves stable question IDs in Supabase, keyed by the signed-in
account. A PostgreSQL transaction and per-account advisory lock serialize selections
across devices and tabs, including every mock section. Exhausted requests fail
explicitly; no offline or local sampling fallback is allowed. Practice and note
cards can request a smaller remaining batch. Reservations include abandoned attempts.
Existing browser history is imported with the next reservation. A cloud reset applies
to all devices and closes legacy imports so stale browsers cannot resurrect the
pre-reset history. Saved-attempt review and spaced repetition may intentionally
revisit questions. Already-open attempts are unaffected by a later reset.

Apply `supabase/migrations/006_question_history.sql` before deploying this frontend.
Authenticated RPCs derive account identity from `auth.uid()`; callers cannot supply
another user's ID. Direct history writes are revoked, and RLS limits reads to the
current account. The integration checks in `scripts/question-history.integration.sql`
run in a rolled-back transaction. They test exhaustion, atomic mock reservation,
legacy import, global reset and account isolation without changing user history.
Run `npm run questions:sync` to reproduce the snapshots. Sources are pinned to
revisions in `scripts/question-importers.mjs`; downloaded-file SHA-256 checksums,
source URLs, licenses, exclusions and counts are recorded in
`public/question-bank/manifest.json`. Attribution and license files ship alongside
the bank. Question text needs no AI key; synchronized selection history requires
the account-history migration above and a working Supabase connection.

The initial accepted bank contains 939 records after validation and deduplication:
466 JEE Main mathematics questions from Physics Wallah's 2025 evaluation set, and
473 JEE Advanced PCM questions from the JEEBench authors' 2016–2023 collection.
Quizzes and mocks use single-correct items; Question Bank practice also supports
multiple-correct and numerical questions. Missing-answer and diagram-dependent
records are excluded. Difficulty remains unassigned where sources provide none.
No answers, exam years, diagrams, or explanations are invented to fill gaps.

The Main/Advanced selectors are explicit. Mixed JEE mocks are practice assemblies,
not replicas of an official Main or Advanced paper or its complete marking mix.
Requests exceeding bank coverage fail clearly, with no AI fallback. Diagnostics
select existing questions without replacement, and report actual subject/topic
metadata. Numerical practice compares against the source value; multiple-correct
practice requires the complete source answer set (no official partial-mark scheme).

## Larger sources reviewed

- SATHEE (IIT Kanpur / Ministry of Education): a substantially larger free archive
  with 2009–2024 JEE coverage. Linked as an external resource. No documented bulk
  question API/import agreement was established during this task, so it is not
  represented as an imported database: https://sathee.iitk.ac.in/pyqs/jee/
- `ruh-ai/grafite-jee-mains-qna-no-img`: 11,392 structured records. No explicit
  dataset license or independent answer-key verification statement was found in
  its card. Not imported.
- `soughed/jee-main-questions` (eQOURSE mirror): declared CC BY 4.0, over 2,300
  advertised records. Sample paper dates were inconsistent with official papers,
  and visual QA exposed missing circuit figures and poor transcriptions. Its
  adapter remains available for auditing, but its records are held out of all
  shipped snapshots. They do not inflate the playable count.
- A 14,000+ question Python package explicitly describes reverse engineering a
  subscription service. Not used as an application dependency.

The current bank is a vetted-format starter collection, not a claim that every
answer has been independently checked by us or that a full, free 10,000+ JEE
collection has been secured. Future imports must retain original question IDs,
source/paper metadata and answer keys, pass the importer tests, and preserve
required attribution. AI-assisted transcription is processing of an existing
paper; it must never invent replacement questions or silently supply missing keys.
