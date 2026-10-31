import { writeFile } from "node:fs/promises";
import { EXAM_RESOURCES, RESOURCE_REVIEW_DATE } from "../src/lib/exam-resources.ts";

await writeFile(
  new URL("../public/study-resources.json", import.meta.url),
  JSON.stringify(
    {
      reviewed: RESOURCE_REVIEW_DATE,
      scope:
        "External publisher resources. No question text, answers or textbook content is copied into the in-app question bank.",
      count: EXAM_RESOURCES.length,
      resources: EXAM_RESOURCES,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Exported ${EXAM_RESOURCES.length} publisher resources.`);
