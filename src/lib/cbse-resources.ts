import type { ExamResource } from "./exam-resources";

const academic = "https://cbseacademic.nic.in";
const manuals = `${academic}/manual.html`;
const sampleIndex = `${academic}/SQP_CLASSX_2026-27.html`;
const subjects = [
  "Mathematics",
  "Science",
  "Social Science",
  "English (Language and Literature)",
  "Hindi A",
  "Hindi B",
];

// Links inspected on CBSE's own subject indexes, 31 October 2026.
// Older banks supplement the current syllabus; they are not current-session papers.
const resource = (
  entry: Pick<
    ExamResource,
    "id" | "title" | "kind" | "subjects" | "url" | "evidenceUrl" | "description"
  > &
    Partial<ExamResource>,
): ExamResource => ({
  examIds: ["cbse-class-10"],
  publisher: "Central Board of Secondary Education (CBSE)",
  access: "free",
  format: "pdf",
  year: null,
  verification: "publisher-index",
  ...entry,
});

export const CBSE_CLASS_10_RESOURCES: ExamResource[] = [
  resource({
    id: "cbse-10-syllabus",
    title: "CBSE secondary curriculum and syllabus — 2026–27",
    kind: "study-material",
    subjects,
    url: `${academic}/curriculum_2027.html`,
    evidenceUrl: `${academic}/curriculum_2027.html`,
    format: "website",
    year: 2027,
    description:
      "Select the Class X subject syllabus for your enrolled course. Check prescribed chapters, assessment scope and internal assessment before using older question banks; some chapters are project or internal-assessment only.",
  }),
  resource({
    id: "cbse-10-ncert",
    title: "NCERT Class 10 textbooks",
    publisher: "NCERT",
    kind: "study-material",
    subjects,
    url: "https://ncert.nic.in/ebooks.php",
    evidenceUrl: "https://epathshala.nic.in/epathshala.php?id=Students&ln=en",
    format: "website",
    description:
      "Official textbook portal. Choose Class X and your subject, language and book; use the current CBSE syllabus to check which portions are assessed.",
  }),
  ...[
    ["english", "English (Language and Literature)", "EnglishX.pdf"],
    ["maths", "Mathematics", "MathsX.pdf"],
    ["science", "Science", "ScienceX.pdf"],
  ].map(([id, subject, file]) =>
    resource({
      id: `cbse-10-question-bank-${id}`,
      title: `CBSE Class 10 ${subject} question bank (archive)`,
      kind: "question-bank",
      subjects: [subject],
      url: `${academic}/web_material/QuestionBank/ClassX/${file}`,
      evidenceUrl: `${academic}/qbclass10.html`,
      description:
        "Original CBSE question bank from its Class X index. An older practice resource, not the current board paper; match chapters and question formats to the current syllabus and sample paper.",
    }),
  ),
  ...[
    ["maths", "Mathematics", "Item-Bank--Maths---Class-10.pdf"],
    ["science", "Science", "Item-Bank---Science-Class-10.pdf"],
    ["english", "English (Language and Literature)", "Item-Bank---English---Class-10.pdf"],
  ].map(([id, subject, file]) =>
    resource({
      id: `cbse-10-cbe-${id}`,
      title: `CBSE competency-based item bank — ${subject}`,
      kind: "question-bank",
      subjects: [subject],
      url: `${academic}/cbe/documents/${file}`,
      evidenceUrl: `${academic}/cbe/assessment.html`,
      description:
        "Class 10 item bank published through CBSE's competency-based education programme with British Council and AlphaPlus. Use the publisher's answers and rubrics; check older topics against the current syllabus.",
    }),
  ),
  ...[
    ["maths-v4", "Mathematics", "Mathematics_10Vol4.pdf", "Mathematics (Volume 4)"],
    ["science-v2", "Science", "Science_Grade10_V2.pdf", "Science (Volume 2)"],
    [
      "social-science-v2",
      "Social Science",
      "SocialScience_10Vol2.pdf",
      "Social Science (Volume 2)",
    ],
    ["hindi", "Hindi A / Hindi B", "PQ_Hindi10.pdf", "Hindi practice questions"],
  ].map(([id, subject, file, title]) =>
    resource({
      id: `cbse-10-practice-${id}`,
      title: `CBSE Grade 10 ${title}`,
      kind: "question-bank",
      subjects: id === "hindi" ? ["Hindi A", "Hindi B"] : [subject],
      url: `${academic}/web_material/Manuals/${file}`,
      evidenceUrl: manuals,
      description:
        "Official practice collection listed in CBSE's handbook catalog. Some downloads are large. Older collections can include rationalised topics; follow the current syllabus and the correct language course. This is supplementary practice, not a prediction of board questions.",
    }),
  ),
  ...[
    ["maths-basic", "Mathematics", "Mathematics (Basic)", "MathsBasic"],
    ["maths-standard", "Mathematics", "Mathematics (Standard)", "MathsStandard"],
    ["science", "Science", "Science", "Science"],
    ["social-science", "Social Science", "Social Science", "SocialScience"],
    [
      "english",
      "English (Language and Literature)",
      "English (Language and Literature)",
      "EnglishL",
    ],
    ["hindi-a", "Hindi A", "Hindi A", "HindiCourseA"],
    ["hindi-b", "Hindi B", "Hindi B", "HindiCourseB"],
  ].flatMap(([id, subject, title, file]) => [
    resource({
      id: `cbse-10-sqp-2027-${id}`,
      title: `CBSE Class 10 ${title} sample paper — 2026–27`,
      kind: "question-bank",
      subjects: [subject],
      url: `${academic}/web_material/SQP/ClassX_2026_27/${file}-SQP.pdf`,
      evidenceUrl: sampleIndex,
      year: 2027,
      description:
        "Official sample paper for academic session 2026–27, not a past examination paper. Use the matching marking scheme in this catalog. Choose Basic or Standard Mathematics and Hindi A or B according to your registration.",
    }),
    resource({
      id: `cbse-10-ms-2027-${id}`,
      title: `CBSE Class 10 ${title} marking scheme — 2026–27`,
      kind: "answer-key",
      subjects: [subject],
      url: `${academic}/web_material/SQP/ClassX_2026_27/${file}-MS.pdf`,
      evidenceUrl: sampleIndex,
      year: 2027,
      description:
        "CBSE's answers, mark allocation and evaluation guidance for the matching 2026–27 sample paper. Use with the same subject and course paper.",
    }),
  ]),
  resource({
    id: "cbse-10-past-paper-archive",
    title: "CBSE official previous-year question paper archive",
    kind: "question-bank",
    subjects,
    url: "https://www.cbse.gov.in/cbsenew/question-paper.html",
    evidenceUrl: "https://www.cbse.gov.in/cbsenew/question-paper.html",
    format: "website",
    description:
      "Select Class X, examination year and subject. CBSE publishes original papers, often as ZIP downloads containing multiple sets. Keep the year, paper set and course together; historical papers can cover a different syllabus.",
  }),
];
