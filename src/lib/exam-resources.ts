export type ExamResource = {
  id: string;
  examIds: string[];
  title: string;
  publisher: string;
  kind: "study-material" | "question-bank" | "past-paper" | "answer-key";
  subjects: string[];
  url: string;
  evidenceUrl: string;
  access: "free" | "free-account" | "mixed";
  format: "website" | "pdf";
  year: number | null;
  description: string;
  verification: "publisher-page" | "publisher-index" | "publisher-announcement";
};

// Manually researched metadata. These are external resources, not imported quiz rows.
// Verification describes the evidence inspected, not an HTTP availability guarantee.
export const RESOURCE_REVIEW_DATE = "2026-10-31";
const ncert = "https://ncert.nic.in/ebooks.php";
const upsc = "https://www.upsc.gov.in/examinations/previous-question-papers";
const ets = "https://www.ets.org/gre/test-takers/general-test/prepare.html";
const sat = "https://satsuite.collegeboard.org/practice";
const satheeEvidence = "https://www.iitk.ac.in/launch-free-crash-course-for-neet-2025";

export const EXAM_RESOURCES: ExamResource[] = [
  {
    id: "ncert-textbooks",
    examIds: ["neet", "upsc-prelims", "jee-main", "jee-advanced"],
    title: "NCERT textbooks",
    publisher: "NCERT",
    kind: "study-material",
    subjects: [
      "Physics",
      "Chemistry",
      "Biology",
      "History",
      "Geography",
      "Economics",
      "Political Science",
    ],
    url: ncert,
    evidenceUrl: "https://epathshala.nic.in/epathshala.php?id=Students&ln=en",
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-index",
    description:
      "Official textbook portal. Use Classes 11–12 science for NEET and school-level humanities for UPSC foundations; check the current exam syllabus for relevance.",
  },
  {
    id: "neet-sathee-learning",
    examIds: ["neet"],
    title: "SATHEE NEET learning and revision",
    publisher: "IIT Kanpur / Ministry of Education",
    kind: "study-material",
    subjects: ["Physics", "Chemistry", "Biology"],
    url: "https://sathee.iitk.ac.in/",
    evidenceUrl: satheeEvidence,
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-announcement",
    description:
      "Government-backed lectures, revision, quizzes and mock-test preparation. Select NEET on SATHEE; some activities may require registration.",
  },
  {
    id: "neet-sathee-pyq",
    examIds: ["neet"],
    title: "SATHEE chapter-wise NEET PYQs",
    publisher: "IIT Kanpur / Ministry of Education",
    kind: "question-bank",
    subjects: ["Physics", "Chemistry", "Biology"],
    url: "https://www.sathee.iitk.ac.in/neet-pyq-chapterwise/",
    evidenceUrl: satheeEvidence,
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-announcement",
    description:
      "Chapter-organized previous-year questions and solutions. SATHEE is an educational compilation; final NTA answer keys take precedence.",
  },
  {
    id: "neet-nta",
    examIds: ["neet"],
    title: "NEET official bulletin, syllabus and notices",
    publisher: "National Testing Agency",
    kind: "study-material",
    subjects: ["Physics", "Chemistry", "Biology"],
    url: "https://neet.nta.nic.in/",
    evidenceUrl: "https://neet.nta.nic.in/",
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-page",
    description:
      "Use NTA's current information bulletin and notices to confirm the syllabus and examination rules.",
  },
  {
    id: "neet-2024-final-key",
    examIds: ["neet"],
    title: "NEET 2024 revised final answer key",
    publisher: "National Testing Agency",
    kind: "answer-key",
    subjects: ["Physics", "Chemistry", "Biology"],
    url: "https://nta.ac.in/Download/Notice/Notice_20240726171027.pdf",
    evidenceUrl: "https://nta.ac.in/Download/Notice/Notice_20240726171027.pdf",
    access: "free",
    format: "pdf",
    year: 2024,
    verification: "publisher-page",
    description:
      "Revised 26 July 2024 key for the 5 May 2024 examination. Match booklet code and question number; this is an answer key, not a question paper.",
  },
  {
    id: "upsc-papers",
    examIds: ["upsc-prelims"],
    title: "UPSC previous-year question paper archive",
    publisher: "Union Public Service Commission",
    kind: "question-bank",
    subjects: ["General Studies", "CSAT"],
    url: upsc,
    evidenceUrl: upsc,
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-page",
    description:
      "Official paper archive. Choose Civil Services (Preliminary) Examination, then General Studies Paper I or Paper II (CSAT).",
  },
  ...[
    [
      2026,
      "QP_CSP_2026_GENERAL_STUDIES_PAPER-I_25052026.pdf",
      "QP_CSP_2026_GENERAL_STUDIES_PAPER-II_25052026.pdf",
    ],
    [
      2025,
      "QP-CSP-25-GENERAL-STUDIES-PAPER-I-26052025.pdf",
      "QP-CSP-25-GENERAL-STUDIES-PAPER-II-26052025.pdf",
    ],
    [
      2024,
      "QP-CSP-24-GENERAL-STUDIES-PAPER-I-180624.pdf",
      "QP-CSP-24-GENERAL-STUDIES-PAPER-II-180624.pdf",
    ],
  ].flatMap(([year, paper1, paper2]) =>
    [paper1, paper2].map(
      (file, i): ExamResource => ({
        id: `upsc-${year}-${i + 1}`,
        examIds: ["upsc-prelims"],
        title: `UPSC Prelims ${year} — ${i === 0 ? "General Studies I" : "CSAT (Paper II)"}`,
        publisher: "Union Public Service Commission",
        kind: "past-paper",
        subjects: [i === 0 ? "General Studies" : "CSAT"],
        url: `https://www.upsc.gov.in/sites/default/files/${file}`,
        evidenceUrl: upsc,
        access: "free",
        format: "pdf",
        year: Number(year),
        verification: "publisher-index",
        description:
          "Original paper linked from the official UPSC archive. Large scanned PDF; obtain the matching year and booklet answer key separately.",
      }),
    ),
  ),
  {
    id: "upsc-keys",
    examIds: ["upsc-prelims"],
    title: "UPSC official answer keys",
    publisher: "Union Public Service Commission",
    kind: "answer-key",
    subjects: ["General Studies", "CSAT"],
    url: "https://www.upsc.gov.in/examinations/answer-key",
    evidenceUrl: upsc,
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-index",
    description:
      "Select Civil Services Preliminary and the matching year. Keys may be published later than papers; match the booklet series before grading.",
  },
  {
    id: "sat-question-bank",
    examIds: ["sat"],
    title: "Official SAT Student Question Bank",
    publisher: "College Board",
    kind: "question-bank",
    subjects: ["Reading and Writing", "Math"],
    url: "https://satsuite.collegeboard.org/practice/student-question-bank",
    evidenceUrl: sat,
    access: "free-account",
    format: "website",
    year: null,
    verification: "publisher-page",
    description:
      "Official practice questions from the test maker, organized by skills. A College Board account is needed for My Practice.",
  },
  {
    id: "sat-tests",
    examIds: ["sat"],
    title: "Official SAT full-length practice tests",
    publisher: "College Board",
    kind: "question-bank",
    subjects: ["Reading and Writing", "Math"],
    url: "https://satsuite.collegeboard.org/practice/practice-tests",
    evidenceUrl: sat,
    access: "free-account",
    format: "website",
    year: null,
    verification: "publisher-page",
    description:
      "Practice-test options from College Board. Use Bluebook for the digital adaptive experience; paper practice differs from digital testing.",
  },
  {
    id: "sat-khan",
    examIds: ["sat"],
    title: "Official SAT preparation with Khan Academy",
    publisher: "College Board / Khan Academy",
    kind: "study-material",
    subjects: ["Reading and Writing", "Math"],
    url: "https://satsuite.collegeboard.org/practice/khan-academy",
    evidenceUrl: sat,
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-page",
    description:
      "College Board's guide to Khan Academy SAT lessons and skill practice. An account can save learning progress.",
  },
  {
    id: "gre-prep",
    examIds: ["gre"],
    title: "Official GRE preparation hub",
    publisher: "ETS",
    kind: "study-material",
    subjects: ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
    url: ets,
    evidenceUrl: ets,
    access: "mixed",
    format: "website",
    year: null,
    verification: "publisher-page",
    description:
      "Test-maker preparation hub with free resources and paid products. Follow the free preparation and review options.",
  },
  {
    id: "gre-powerprep",
    examIds: ["gre"],
    title: "GRE POWERPREP practice tests",
    publisher: "ETS",
    kind: "question-bank",
    subjects: ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
    url: "https://www.ets.org/gre/test-takers/general-test/prepare/powerprep.html",
    evidenceUrl: ets,
    access: "mixed",
    format: "website",
    year: null,
    verification: "publisher-page",
    description:
      "Official practice-test platform. Free POWERPREP options require an ETS account; POWERPREP PLUS products are paid.",
  },
  {
    id: "gre-math-review",
    examIds: ["gre"],
    title: "GRE Math Review",
    publisher: "ETS",
    kind: "study-material",
    subjects: ["Quantitative Reasoning"],
    url: "https://globalhighered.ets.org/gre-math-review",
    evidenceUrl: ets,
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-index",
    description:
      "ETS landing page for its mathematics review covering foundational quantitative concepts. Follow the publisher's download flow.",
  },
  {
    id: "gre-math-conventions",
    examIds: ["gre"],
    title: "GRE mathematical conventions",
    publisher: "ETS",
    kind: "study-material",
    subjects: ["Quantitative Reasoning"],
    url: "https://globalhighered.ets.org/gre-mathematical-conventions",
    evidenceUrl: ets,
    access: "free",
    format: "website",
    year: null,
    verification: "publisher-index",
    description:
      "Official mathematical terminology, notation and assumptions used in GRE quantitative questions.",
  },
];

export function resourcesForExam(examId: string) {
  return EXAM_RESOURCES.filter((resource) => resource.examIds.includes(examId));
}
