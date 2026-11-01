/** Conservative, versioned topic rules. Uncertain searches go to semantic selection. */
export const QUIZ_TOPICS = [
  [
    "Chemical Bonding",
    "Chemistry",
    [
      "chemical bonding",
      "bonding",
      "molecular geometry",
      "vsepr",
      "hybridization",
      "hybridisation",
      "bond order",
      "molecular orbital theory",
    ],
    /\b(hybridiz|hybridis|vsepr|bond order|bond angle|molecular orbital|hydrogen bond|covalent bond|ionic bond|dipole moment|paramagnetic|diamagnetic|lewis structure|lone pair|molecular geometry)/i,
  ],
  [
    "Atomic Structure",
    "Chemistry",
    ["atomic structure", "structure of atom", "electronic configuration"],
    /\b(quantum number|electronic configuration|electron configuration|bohr|atomic orbital|heisenberg|aufbau|hund.s rule)/i,
  ],
  [
    "Chemical Kinetics",
    "Chemistry",
    ["chemical kinetics", "reaction rates", "rate of reaction"],
    /\b(rate constant|activation energy|arrhenius|first.order reaction|second.order reaction|order of.*reaction|rate law)/i,
  ],
  [
    "Equilibrium",
    "Chemistry",
    ["equilibrium", "ionic equilibrium", "chemical equilibrium", "acids and bases"],
    /\b(equilibrium constant|le chatelier|buffer|solubility product|pka|pkb|dissociation constant|ph of)/i,
  ],
  [
    "Electrochemistry",
    "Chemistry",
    ["electrochemistry", "electrochemical cells", "nernst equation"],
    /\b(nernst|electrolysis|electrode potential|galvanic|electrochemical|molar conductivity)/i,
  ],
  [
    "Chemical Thermodynamics",
    "Chemistry",
    ["chemical thermodynamics", "thermochemistry", "enthalpy"],
    /\b(enthalpy|gibbs|hess.s law|entropy|heat of (formation|combustion|reaction))/i,
  ],
  [
    "Organic Chemistry",
    "Chemistry",
    [
      "organic chemistry",
      "goc",
      "organic chemistry basics",
      "general organic chemistry",
      "hydrocarbons",
    ],
    /\b(alkane|alkene|alkyne|benzene|carbocation|carbanion|isomer|aromatic|nucleophil|electrophil|grignard|alcohol|aldehyde|ketone)/i,
  ],
  [
    "Coordination Compounds",
    "Chemistry",
    ["coordination compounds", "coordination chemistry", "complex compounds"],
    /\b(ligand|coordination number|crystal field|complex ion|chelat|coordination compound)/i,
  ],
  [
    "Periodic Properties",
    "Chemistry",
    ["periodic table", "periodic properties", "classification of elements", "periodicity"],
    /\b(ionization energ|ionisation energ|electron affinity|atomic radi|electronegativ|periodic table)/i,
  ],
  [
    "Mole Concept",
    "Chemistry",
    ["mole concept", "stoichiometry", "some basic concepts in chemistry"],
    /\b(moles? of|molar mass|avogadro|stoichiometr|empirical formula|limiting reagent)/i,
  ],
  [
    "Solutions",
    "Chemistry",
    ["solutions", "colligative properties"],
    /\b(osmotic pressure|raoult|colligative|boiling point elevation|freezing point depression|molality)/i,
  ],
  [
    "Kinematics",
    "Physics",
    ["kinematics", "projectile motion", "motion in a straight line", "motion in a plane"],
    /\b(projectile|displacement|uniform acceleration|initial velocity|time of flight|velocity.time)/i,
  ],
  [
    "Laws of Motion",
    "Physics",
    ["laws of motion", "newtons laws", "newton's laws", "friction", "nlm"],
    /\b(friction|coefficient of friction|newton.s (first|second|third)|tension in|pulley|free.body)/i,
  ],
  [
    "Work Energy and Power",
    "Physics",
    ["work energy and power", "work and energy", "work energy", "conservation of energy"],
    /\b(kinetic energy|potential energy|work done|conservation of energy|power delivered)/i,
  ],
  [
    "Rotational Motion",
    "Physics",
    ["rotational motion", "rotation", "centre of mass", "center of mass"],
    /\b(moment of inertia|angular momentum|torque|rolling|centre of mass|center of mass)/i,
  ],
  [
    "Gravitation",
    "Physics",
    ["gravitation", "gravity", "satellites"],
    /\b(gravitational|escape velocity|satellite|kepler|orbital velocity)/i,
  ],
  [
    "Thermodynamics",
    "Physics",
    ["thermodynamics", "heat", "thermal physics", "kinetic theory of gases"],
    /\b(carnot|heat engine|adiabatic|isothermal|specific heat|ideal gas|thermal|temperature|rms speed)/i,
  ],
  [
    "Oscillations and Waves",
    "Physics",
    ["oscillations and waves", "oscillations", "simple harmonic motion", "shm", "waves", "sound"],
    /\b(harmonic motion|pendulum|oscillat|wavelength|wave speed|doppler|standing wave|sound wave)/i,
  ],
  [
    "Electrostatics",
    "Physics",
    ["electrostatics", "electric charges and fields", "capacitance", "capacitors"],
    /\b(electric field|electric potential|coulomb|capacitor|capacitance|gauss.s law|point charge)/i,
  ],
  [
    "Current Electricity",
    "Physics",
    ["current electricity", "electric circuits", "ohms law", "resistance"],
    /\b(resistor|resistivity|ohm|kirchhoff|wheatstone|potentiometer|drift velocity|electric current)/i,
  ],
  [
    "Magnetism",
    "Physics",
    ["magnetism", "magnetic effects of current", "moving charges and magnetism"],
    /\b(magnetic field|lorentz|biot.savart|solenoid|cyclotron|magnetic flux)/i,
  ],
  [
    "Electromagnetic Induction",
    "Physics",
    ["electromagnetic induction", "emi", "alternating current", "ac circuits"],
    /\b(induced emf|inductance|lenz|faraday|alternating current|transformer|reactance|impedance)/i,
  ],
  [
    "Optics",
    "Physics",
    ["optics", "ray optics", "wave optics", "light"],
    /\b(lens|mirror|refraction|refractive index|diffraction|interference|young.s double|polariz|polaris)/i,
  ],
  [
    "Modern Physics",
    "Physics",
    [
      "modern physics",
      "atoms and nuclei",
      "nuclear physics",
      "dual nature of matter and radiation",
      "photoelectric effect",
    ],
    /\b(photoelectric|de broglie|radioactiv|half.life|nuclear|photon|hydrogen atom|binding energy)/i,
  ],
  [
    "Electronic Devices",
    "Physics",
    ["electronic devices", "semiconductors", "semiconductor electronics"],
    /\b(semiconductor|diode|transistor|logic gate|rectifier|p.n junction)/i,
  ],
  [
    "Units and Measurements",
    "Physics",
    ["units and measurements", "dimensions", "dimensional analysis", "measurement errors"],
    /\b(dimensional|significant figures|vernier|screw gauge|percentage error|least count)/i,
  ],
  [
    "Trigonometry",
    "Mathematics",
    ["trigonometry", "trigonometric functions", "inverse trigonometry"],
    /\\(?:sin|cos|tan|cot|sec|csc)|\btrigonometr/i,
  ],
  [
    "Integral Calculus",
    "Mathematics",
    ["integral calculus", "integration", "integrals", "definite integrals", "indefinite integrals"],
    /\\int\b|\bintegral|\bintegration/i,
  ],
  [
    "Differential Calculus",
    "Mathematics",
    [
      "differential calculus",
      "limits and derivatives",
      "limits",
      "derivatives",
      "differentiation",
      "continuity",
      "application of derivatives",
    ],
    /\b(derivative|differentiat|continuity|differentiable|local maxim|local minim)|\\lim\b/i,
  ],
  [
    "Differential Equations",
    "Mathematics",
    ["differential equations"],
    /\bdifferential equation|\\frac\{d[yx]\}/i,
  ],
  [
    "Matrices and Determinants",
    "Mathematics",
    ["matrices and determinants", "matrices", "determinants", "matrix"],
    /\b(matrix|matrices|determinant|adjoint)|\\begin\{[bpvV]?matrix\}/i,
  ],
  [
    "Complex Numbers",
    "Mathematics",
    ["complex numbers", "complex number"],
    /\b(complex number|argand|modulus|conjugate|imaginary part|real part)/i,
  ],
  [
    "Quadratic Equations",
    "Mathematics",
    ["quadratic equations", "quadratics"],
    /\b(quadratic|discriminant|roots of.*equation)/i,
  ],
  [
    "Sequences and Series",
    "Mathematics",
    [
      "sequences and series",
      "sequences",
      "series",
      "arithmetic progression",
      "geometric progression",
    ],
    /\b(arithmetic progression|geometric progression|sequence|sum of.*terms|series)/i,
  ],
  [
    "Probability",
    "Mathematics",
    [
      "probability",
      "statistics and probability",
      "statistics",
      "permutations and combinations",
      "permutations",
      "combinations",
    ],
    /\b(probability|random variable|variance|standard deviation|permutation|combination|dice|coin|binomial distribution)/i,
  ],
  [
    "Coordinate Geometry",
    "Mathematics",
    [
      "coordinate geometry",
      "conic sections",
      "straight lines",
      "circles",
      "parabola",
      "ellipse",
      "hyperbola",
    ],
    /\b(parabola|ellipse|hyperbola|circle|straight line|tangent|coordinate|focus|foci)/i,
  ],
  [
    "Vector Algebra",
    "Mathematics",
    ["vector algebra", "vectors", "three dimensional geometry", "3d geometry"],
    /\b(vector|coplanar|direction cosine|scalar product|cross product)|\\(?:vec|hat)\b/i,
  ],
  [
    "Sets Relations and Functions",
    "Mathematics",
    ["sets relations and functions", "sets", "relations", "functions"],
    /\b(injective|surjective|bijective|equivalence relation|domain|range of|function)/i,
  ],
  [
    "Genetics",
    "Biology",
    ["genetics", "inheritance", "molecular basis of inheritance"],
    /\b(mendel|allele|genotype|phenotype|inheritance|dna|rna|codon|transcription|translation)/i,
  ],
  [
    "Human Physiology",
    "Biology",
    ["human physiology", "digestion", "respiration", "circulation", "excretion", "neural control"],
    /\b(nephron|kidney|heart|haemoglobin|hemoglobin|digestion|neuron|hormone|insulin|blood|alveol)/i,
  ],
  [
    "Plant Physiology",
    "Biology",
    ["plant physiology", "photosynthesis", "plant growth", "transport in plants"],
    /\b(photosynth|chlorophyll|calvin|transpiration|xylem|phloem|auxin|gibberellin|stomata)/i,
  ],
  [
    "Ecology",
    "Biology",
    ["ecology", "ecosystem", "biodiversity", "environment"],
    /\b(ecosystem|biodiversity|food chain|ecological|population|biome|conservation|pollution)/i,
  ],
  [
    "Cell Biology",
    "Biology",
    ["cell biology", "cell structure", "cell cycle", "biomolecules"],
    /\b(mitochondri|ribosome|organelle|cell cycle|mitosis|meiosis|cell membrane|lysosome)/i,
  ],
  [
    "Reproduction",
    "Biology",
    ["reproduction", "human reproduction", "sexual reproduction in flowering plants"],
    /\b(pollination|fertilization|fertilisation|embryo|gamete|ovulation|spermatogen|menstrual)/i,
  ],
  [
    "Evolution",
    "Biology",
    ["evolution", "origin of life"],
    /\b(darwin|natural selection|hardy.weinberg|evolution|homologous|analogous)/i,
  ],
  [
    "Biotechnology",
    "Biology",
    ["biotechnology", "biotechnology and its applications"],
    /\b(recombinant|plasmid|restriction enzyme|pcr|polymerase chain|transgenic|biotechnology)/i,
  ],
] as const;

export function normalizeTopic(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function indexQuestionTopics<
  T extends { subject: string; topic: string; tags: string[]; question: string; options: string[] },
>(question: T): T {
  const inferred = QUIZ_TOPICS.filter(
    ([, subject, , pattern]) =>
      subject === question.subject &&
      pattern.test(`${question.question} ${question.options.join(" ")}`),
  ).map(([name]) => name);
  return {
    ...question,
    topic: question.topic || inferred[0] || "",
    tags: [...new Set([...question.tags, ...inferred])],
  };
}

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}

export function resolveTopic(query: string) {
  const normalized = normalizeTopic(query);
  const exact = QUIZ_TOPICS.find(([, , aliases]) =>
    aliases.some((alias) => normalizeTopic(alias) === normalized),
  );
  if (exact) return exact;
  // Correct small typos in whole topic names, never broad substring matches.
  if (normalized.length < 7) return undefined;
  const matches = QUIZ_TOPICS.filter(([, , aliases]) =>
    aliases.some((alias) => {
      const candidate = normalizeTopic(alias);
      const tolerance = normalized.length > 13 ? 2 : 1;
      return (
        Math.abs(candidate.length - normalized.length) <= tolerance &&
        distance(candidate, normalized) <= tolerance
      );
    }),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function structuredTopicMatches<
  T extends { subject: string; topic: string; tags: string[]; question: string; options: string[] },
>(questions: T[], query: string): T[] {
  const normalized = normalizeTopic(query);
  if (!normalized) return questions;
  const subjects = ["Physics", "Chemistry", "Mathematics", "Biology"];
  const subject = subjects.find(
    (value) =>
      normalizeTopic(value) === normalized || (normalized === "maths" && value === "Mathematics"),
  );
  if (subject) return questions.filter((q) => q.subject === subject);
  const topic = resolveTopic(query);
  return questions.filter((q) => {
    const metadata = [q.topic, ...q.tags].map(normalizeTopic);
    if (metadata.includes(normalized)) return true;
    if (!topic || q.subject !== topic[1]) return false;
    return (
      metadata.some((value) => topic[2].some((alias) => normalizeTopic(alias) === value)) ||
      topic[3].test(`${q.question} ${q.options.join(" ")}`)
    );
  });
}

export function validateQuizRequest(topic: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 15)
    throw new Error("Choose between 1 and 15 questions.");
  if (topic.length > 200) throw new Error("Keep your topic under 200 characters.");
  if (
    topic.trim() &&
    (!/\p{L}/u.test(topic) ||
      normalizeTopic(topic).length < 2 ||
      /(.)\1{6}/u.test(normalizeTopic(topic)))
  )
    throw new Error("Enter a recognizable exam topic, such as Chemical Bonding or Kinematics.");
}
