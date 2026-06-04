export interface ExamSubject {
  name: string;
  topics: string[];
}

export interface ExamPattern {
  sections: { name: string; questions: number; timeMinutes: number }[];
  totalTimeMinutes: number;
  totalQuestions: number;
  markingScheme: string;
}

export interface ExamInfo {
  id: string;
  name: string;
  shortName: string;
  description: string;
  country: string;
  icon: string;
  color: string;
  typicalMonth: string;
  subjects: ExamSubject[];
  examPattern: ExamPattern;
}

export const EXAM_CATALOG: ExamInfo[] = [
  {
    id: "jee-main",
    name: "JEE Main",
    shortName: "JEE Main",
    description: "Joint Entrance Examination for admission to NITs, IIITs, and other engineering colleges in India.",
    country: "IN",
    icon: "⚡",
    color: "#3b82f6",
    typicalMonth: "January / April",
    examPattern: {
      sections: [
        { name: "Physics", questions: 30, timeMinutes: 60 },
        { name: "Chemistry", questions: 30, timeMinutes: 60 },
        { name: "Mathematics", questions: 30, timeMinutes: 60 },
      ],
      totalTimeMinutes: 180,
      totalQuestions: 90,
      markingScheme: "+4 for correct, -1 for wrong (MCQ). No negative marking for numerical.",
    },
    subjects: [
      {
        name: "Physics",
        topics: [
          "Units and Measurements", "Kinematics", "Laws of Motion", "Work, Energy and Power",
          "Rotational Motion", "Gravitation", "Properties of Solids and Liquids",
          "Thermodynamics", "Kinetic Theory of Gases", "Oscillations and Waves",
          "Electrostatics", "Current Electricity", "Magnetic Effects of Current",
          "Electromagnetic Induction", "Electromagnetic Waves", "Optics",
          "Dual Nature of Matter and Radiation", "Atoms and Nuclei",
          "Electronic Devices", "Communication Systems",
        ],
      },
      {
        name: "Chemistry",
        topics: [
          "Some Basic Concepts in Chemistry", "Atomic Structure", "Chemical Bonding",
          "States of Matter", "Chemical Thermodynamics", "Equilibrium",
          "Redox Reactions", "Electrochemistry", "Chemical Kinetics",
          "Surface Chemistry", "Classification of Elements", "Hydrogen",
          "s-Block Elements", "p-Block Elements", "d and f Block Elements",
          "Coordination Compounds", "Organic Chemistry Basics",
          "Hydrocarbons", "Organic Compounds with Functional Groups",
          "Polymers", "Biomolecules", "Chemistry in Everyday Life",
        ],
      },
      {
        name: "Mathematics",
        topics: [
          "Sets, Relations and Functions", "Complex Numbers", "Quadratic Equations",
          "Matrices and Determinants", "Permutations and Combinations",
          "Binomial Theorem", "Sequences and Series", "Limits and Derivatives",
          "Integral Calculus", "Differential Equations", "Coordinate Geometry",
          "Straight Lines", "Conic Sections", "Three Dimensional Geometry",
          "Vector Algebra", "Statistics and Probability", "Trigonometry",
          "Mathematical Reasoning",
        ],
      },
    ],
  },
  {
    id: "jee-advanced",
    name: "JEE Advanced",
    shortName: "JEE Adv",
    description: "Advanced entrance exam for admission to IITs — India's premier engineering institutes.",
    country: "IN",
    icon: "🔥",
    color: "#ef4444",
    typicalMonth: "June",
    examPattern: {
      sections: [
        { name: "Paper 1 - Physics", questions: 18, timeMinutes: 60 },
        { name: "Paper 1 - Chemistry", questions: 18, timeMinutes: 60 },
        { name: "Paper 1 - Mathematics", questions: 18, timeMinutes: 60 },
      ],
      totalTimeMinutes: 180,
      totalQuestions: 54,
      markingScheme: "Variable marking: +3/+4 for correct, -1 for wrong. Partial marking for some questions.",
    },
    subjects: [
      {
        name: "Physics",
        topics: [
          "Mechanics", "Thermal Physics", "Electricity and Magnetism",
          "Optics", "Modern Physics", "Waves and Sound",
          "Fluid Mechanics", "Rotational Dynamics", "Electrostatics",
          "Electromagnetic Induction", "Alternating Current", "Nuclear Physics",
        ],
      },
      {
        name: "Chemistry",
        topics: [
          "Physical Chemistry - Thermodynamics", "Physical Chemistry - Equilibrium",
          "Physical Chemistry - Kinetics", "Physical Chemistry - Electrochemistry",
          "Inorganic Chemistry - Periodic Table", "Inorganic Chemistry - Coordination",
          "Inorganic Chemistry - Metallurgy", "Organic Chemistry - Reaction Mechanisms",
          "Organic Chemistry - Named Reactions", "Organic Chemistry - Biomolecules",
          "Organic Chemistry - Polymers",
        ],
      },
      {
        name: "Mathematics",
        topics: [
          "Algebra", "Trigonometry", "Analytical Geometry",
          "Differential Calculus", "Integral Calculus", "Vectors",
          "Probability", "Matrices", "Complex Numbers",
          "Differential Equations", "3D Geometry",
        ],
      },
    ],
  },
  {
    id: "neet",
    name: "NEET UG",
    shortName: "NEET",
    description: "National Eligibility cum Entrance Test for admission to medical and dental colleges in India.",
    country: "IN",
    icon: "🩺",
    color: "#10b981",
    typicalMonth: "May",
    examPattern: {
      sections: [
        { name: "Physics", questions: 50, timeMinutes: 60 },
        { name: "Chemistry", questions: 50, timeMinutes: 60 },
        { name: "Biology", questions: 100, timeMinutes: 80 },
      ],
      totalTimeMinutes: 200,
      totalQuestions: 200,
      markingScheme: "+4 for correct, -1 for wrong.",
    },
    subjects: [
      {
        name: "Physics",
        topics: [
          "Physical World and Measurement", "Kinematics", "Laws of Motion",
          "Work, Energy and Power", "Motion of System of Particles",
          "Gravitation", "Properties of Bulk Matter", "Thermodynamics",
          "Kinetic Theory of Gases", "Oscillations and Waves",
          "Electrostatics", "Current Electricity", "Magnetic Effects of Current",
          "Electromagnetic Induction and AC", "Electromagnetic Waves",
          "Optics", "Dual Nature of Radiation", "Atoms and Nuclei",
          "Electronic Devices",
        ],
      },
      {
        name: "Chemistry",
        topics: [
          "Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements",
          "Chemical Bonding", "States of Matter", "Thermodynamics",
          "Equilibrium", "Redox Reactions", "Hydrogen", "s-Block Elements",
          "p-Block Elements", "Organic Chemistry Basics", "Hydrocarbons",
          "Environmental Chemistry", "Solid State", "Solutions",
          "Electrochemistry", "Chemical Kinetics", "Surface Chemistry",
          "d and f Block Elements", "Coordination Compounds",
          "Aldehydes, Ketones", "Amines", "Biomolecules", "Polymers",
        ],
      },
      {
        name: "Biology",
        topics: [
          "Diversity in Living World", "Structural Organisation in Animals and Plants",
          "Cell Structure and Function", "Plant Physiology", "Human Physiology",
          "Reproduction", "Genetics and Evolution", "Biology and Human Welfare",
          "Biotechnology", "Ecology and Environment",
        ],
      },
    ],
  },
  {
    id: "upsc-prelims",
    name: "UPSC Civil Services Prelims",
    shortName: "UPSC",
    description: "Preliminary exam for Indian Administrative Service (IAS) and other civil services.",
    country: "IN",
    icon: "🏛️",
    color: "#f59e0b",
    typicalMonth: "June",
    examPattern: {
      sections: [
        { name: "General Studies Paper I", questions: 100, timeMinutes: 120 },
        { name: "CSAT Paper II", questions: 80, timeMinutes: 120 },
      ],
      totalTimeMinutes: 240,
      totalQuestions: 180,
      markingScheme: "+2 for correct, -0.66 for wrong.",
    },
    subjects: [
      {
        name: "General Studies",
        topics: [
          "Indian History", "Indian National Movement", "World History",
          "Indian Geography", "World Geography", "Indian Polity and Governance",
          "Economic and Social Development", "General Science",
          "Environment and Ecology", "Current Affairs",
        ],
      },
      {
        name: "CSAT",
        topics: [
          "Comprehension", "Interpersonal Skills", "Logical Reasoning",
          "Analytical Ability", "Decision Making", "Problem Solving",
          "General Mental Ability", "Basic Numeracy", "Data Interpretation",
          "English Language Comprehension",
        ],
      },
    ],
  },
  {
    id: "sat",
    name: "SAT",
    shortName: "SAT",
    description: "Standardized test for college admissions in the United States.",
    country: "US",
    icon: "🎓",
    color: "#8b5cf6",
    typicalMonth: "March / May / August / October / December",
    examPattern: {
      sections: [
        { name: "Reading and Writing", questions: 54, timeMinutes: 64 },
        { name: "Math", questions: 44, timeMinutes: 70 },
      ],
      totalTimeMinutes: 134,
      totalQuestions: 98,
      markingScheme: "No negative marking. Score range 400–1600.",
    },
    subjects: [
      {
        name: "Reading and Writing",
        topics: [
          "Information and Ideas", "Craft and Structure", "Expression of Ideas",
          "Standard English Conventions", "Words in Context",
          "Text Structure and Purpose", "Cross-Text Connections",
          "Command of Evidence", "Rhetorical Synthesis",
        ],
      },
      {
        name: "Math",
        topics: [
          "Algebra", "Linear Equations", "Systems of Equations",
          "Advanced Math", "Quadratic and Polynomial Functions",
          "Exponential Functions", "Problem Solving and Data Analysis",
          "Ratios and Proportions", "Percentages", "Probability and Statistics",
          "Geometry and Trigonometry", "Circles", "Area and Volume",
        ],
      },
    ],
  },
  {
    id: "gre",
    name: "GRE General Test",
    shortName: "GRE",
    description: "Graduate Record Examination for admission to graduate programs worldwide.",
    country: "International",
    icon: "📚",
    color: "#06b6d4",
    typicalMonth: "Year-round (computer-based)",
    examPattern: {
      sections: [
        { name: "Verbal Reasoning", questions: 27, timeMinutes: 41 },
        { name: "Quantitative Reasoning", questions: 27, timeMinutes: 47 },
        { name: "Analytical Writing", questions: 1, timeMinutes: 30 },
      ],
      totalTimeMinutes: 118,
      totalQuestions: 55,
      markingScheme: "No negative marking. Verbal & Quant: 130–170 each. Writing: 0–6.",
    },
    subjects: [
      {
        name: "Verbal Reasoning",
        topics: [
          "Reading Comprehension", "Text Completion", "Sentence Equivalence",
          "Critical Reasoning", "Vocabulary in Context",
          "Analyzing Arguments", "Summarizing Passages",
        ],
      },
      {
        name: "Quantitative Reasoning",
        topics: [
          "Arithmetic", "Algebra", "Geometry", "Data Analysis",
          "Number Properties", "Ratios and Proportions",
          "Probability and Counting", "Statistics", "Word Problems",
          "Quantitative Comparison", "Data Interpretation",
        ],
      },
      {
        name: "Analytical Writing",
        topics: [
          "Analyze an Issue", "Argument Analysis", "Essay Structure",
          "Critical Thinking", "Evidence-Based Writing",
        ],
      },
    ],
  },
];

export function getExamById(id: string): ExamInfo | undefined {
  return EXAM_CATALOG.find((e) => e.id === id);
}
