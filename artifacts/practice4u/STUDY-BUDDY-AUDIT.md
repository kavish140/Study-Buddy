# Study Buddy compatibility and random answer check

Audited on 1 November 2026. The compatibility audit was followed by a local import of the 3,679 candidates into their supported exam banks; see README.md for the import counts. No production deployment was performed.

## Compatibility

Study Buddy currently loads JEE Main, JEE Advanced and NEET banks. Its full practice mode supports single-choice, multiple-choice and numerical questions. Quizzes and mocks select only single-choice questions. The data needs conversion to Study Buddy's `BankQuestion` schema before use.

Of the 4,776 exported records, **3,679 are technical candidates** after conservative validation. Of those, **2,313** fit quizzes/mocks; the remaining **1,366** need the full practice flow (1,171 numerical and 195 multiple-choice).

| Exam | Full practice candidates | MCQ quiz/mock candidates |
|---|---:|---:|
| JEE Main | 3,381 | 2,210 |
| JEE Advanced | 1,811 | 885 |
| NEET | 128 | 128 |

Exam tags overlap: these rows must not be added together. JEE Main excludes multiple-correct questions, and NEET excludes numerical/multiple-correct questions. Subject totals across the 3,679 unique candidates: Mathematics 1,451; Physics 1,706; Chemistry 478; Biology 44.

**1,097 records are held.** Reasons overlap:

- 658 have no supported exam/type combination, including Foundation-only records.
- 9 use the unsupported grid/matrix-match answer type.
- 277 carry question SVGs (`fig`), 31 solution figures (`sfig`), 44 option figures (`of`), 45 matching tables (`mm`), and 18 shared passages (`para`). Study Buddy's current schema/rendering does not preserve these fields as displayed question content.
- 40 have invalid/blank options; 43 fail the distinct-options check, including overlap with blank-option cases.
- 45 additional records reference visual/context material and need manual inspection.

No exact question-plus-option duplicates were found within the export or between candidates and the shipped banks after case, Unicode and whitespace normalization. This is not semantic deduplication.

`study-buddy-eligibility.json` lists every question ID, its applicable exams, candidate/hold decision, reasons, and whether its answer was sampled. `study-buddy-candidates.json` contains the candidate records with original fields retained. Candidate does not mean individually verified. Original/PYQ labels remain source claims; official-paper provenance was not independently audited.

## Random sample

The final sample consists of **10 distinct records chosen uniformly without replacement from all 4,776**, using Python `secrets.SystemRandom().sample`. No records were redrawn or substituted. The IDs and full source records are saved in `random-audit-sample.json` and `audit-sample-ids.json`. The random draw happened to contain seven Physics and three Mathematics questions; it provides no direct Chemistry/Biology validation.

Results: **9 verified keys; 1 conditional key; no definitely wrong key found.** The working below was derived independently. Merely matching a stored solution was not treated as verification.

| ID | Question, paraphrased | Independent result | Verdict |
|---|---|---|---|
| `jmp12-59` | Ocean-water compression at 4,000 m | rho*g*h/B = 0.02, so alpha = **2** | Correct |
| `jmp06-43` | Tension between balls 7 and 8 when six hang | a = 0.6g; T = 6a = **3.6g N**. The stored **36 N** requires g = 10 | Conditional: g is omitted; preserve SVG numbering |
| `jmp13-22` | Reynolds-number formula | **rho*v*d/eta**, option **C** | Correct |
| `eo-m-pc-46` | Four-digit PINs with exactly two distinct digits | C(10,2)*(2^4-2) = **630**; also confirmed by enumerating all 10,000 PINs | Correct |
| `dcp-m1v-37` | Four forces along a square | Components (-4P,P), magnitude **sqrt(17) P**, option **A** | Correct |
| `jadv-m-s1-20` | Four column-matching problems | Results **3,9,6,5**, matching **A-1, B-5, C-3, D-2** | Correct key; requires grid UI |
| `jmp06-76` | Extension of a rotating spring | kx = m*omega^2*(l+x), so **m*l*omega^2/(k-m*omega^2)**, option **B** | Correct; positive equilibrium requires k > m*omega^2 |
| `jmp09-09` | Compare four moments of inertia | First three = MR^2/2; sphere = 2MR^2/5. **I1=I2=I3>I4**, option **C** | Correct |
| `jmp09-98` | Rotational/total kinetic energy of rolling shell | For a thin shell without slipping: (2/3)/(1+2/3) = **2/5**, so **x=2** | Correct under standard rolling assumptions |
| `ea-ut2-4.i` | AP with endpoints 5 and 45 and sum 400 | 400 = n*(5+45)/2, so **n=16** | Correct; Foundation-only, outside current bank scope |

For the grid question, the complete stem is in `original.mm`, not the top-level question text. Independently: Bayes gives 1/3 = p/9, hence p=3; sum k^2*C(9,k)=9*10*2^7 gives m=9; convexity of 10t/(2-t) gives minimum 6 at x=y=z=1/3; Vandermonde reduces the last sum to 100*C(18,9), yielding p=5. Exact integer calculations confirmed the two combinatorial sums.

The Reynolds-number identity was cross-checked against [NASA Glenn](https://www.grc.nasa.gov/www/k-12/airplane/reynolds.html). Compression and rolling-energy relations were checked against OpenStax [elastic modulus](https://openstax.org/books/university-physics-volume-1/pages/12-3-stress-strain-and-elastic-modulus) and [rolling motion](https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion).

Seven sampled records are technical candidates. The other three are held for the SVG dependency, grid UI, and unsupported Foundation exam, respectively. A sample of ten cannot establish the accuracy of the full bank.

## Export limitation discovered during audit

The raw export and `questions.json` preserve figures, tables and passages inside each question's `original` object. The earlier flattened CSV does not include those fields, so it is **not a complete standalone representation of visual, grid or passage questions**. Use the original JSON for those records. The previous no-missing-fields check confirmed that text/answer/solution fields were populated; it did not establish question completeness or answer correctness.
