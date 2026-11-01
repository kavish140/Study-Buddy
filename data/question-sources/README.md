# Pinned question sources

`practice4u.json` contains the 3,679 records accepted by the compatibility audit of the user's signed-in Practice4U collection captured on 1 November 2026. It retains source questions, answers and solutions; it does not include authentication credentials. Visual/grid/passage-dependent and invalid-option records were excluded. Exam tags overlap.

Run `npm run questions:import-practice4u` to rebuild this source's entries in the three public exam banks without changing the other sources. `npm run questions:sync` also reapplies this snapshot after refreshing the upstream JEE and NEET datasets. Repeated imports replace this source and deduplicate within each exam.

Questions are mapped to JEE Main (single-choice/numerical), JEE Advanced (single-choice/multiple-choice/numerical), and NEET (single-choice Physics/Chemistry/Biology). They are labeled practice with no verified exam year. No AI-generated replacement questions or answer keys are created during import. The manifest records the snapshot checksum, unique source-question count and exam placements.

Practice4U asserts copyright; all rights reserved. This snapshot does not assert an open redistribution license. See `public/question-bank/NOTICE.md` for attribution. Only ten randomly selected records were spot-checked; this is not verification of the entire collection.

The audit report, sampled IDs and independent calculations are versioned in `artifacts/practice4u`. The raw website captures and bulk intermediate exports remain local. The formatting and audit scripts require those local capture inputs; the normal question-bank import uses only the pinned snapshot in this directory.
