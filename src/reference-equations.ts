// Transcribed from the user's 25 screenshots, in filename order.
// Floor brackets and absolute-value bars are written as floor() and abs().
export interface ReferenceEquation {
  id: string;
  name: string;
  screenshot: string;
  category: string;
  expression: string;
  randomExpression?: string;
  notes?: string;
}
const tri = (x: string) => `(1 - 2 * abs(2 * ((${x}) mod 1) - 1))`;
const harmonics = `0.5 + 0.16 * ${tri("x / 8")} + 0.12 * ${tri("3 * x / 8")} + 0.09 * ${tri("5 * x / 8")} + 0.07 * ${tri("7 * x / 8")} + 0.05 * ${tri("11 * x / 8")}`;
export const referenceEquations: ReferenceEquation[] = [
  {
    id: "01",
    name: "Two bounded notes",
    screenshot: "000224",
    category: "gaps",
    expression:
      "{ 0.5 if -7.5776 <= x < -7.2207; 0.25 if -7.2207 <= x < -6.9518 }",
    randomExpression:
      "{ 0.5 if x mod 2 < 0.3569; 0.25 if 0.3569 <= x mod 2 < 0.6258 }",
    notes:
      "The original exists only at negative x. Random translates it to x = 0 and repeats every two beats, preserving both note lengths and the rest.",
  },
  {
    id: "02",
    name: "Four decay branches",
    screenshot: "000241",
    category: "envelopes",
    expression:
      "{ -2.34 + 1.88 * exp(-7.69 * (x mod 4)) + 0.938 * sin(31.4 * (x mod 4)) if x mod 4 < 0.5; 1.98 + 1.25 * exp(-25 * ((x + 2) mod 8)) if (x + 2) mod 8 < 0.25; -4 + 2.28 * exp(-5.56 * ((x + 6) mod 8)) if (x + 6) mod 8 < 0.75; -5 + 2.5 * exp(-4.35 * (x mod 2)) if x mod 2 < 2 }",
  },
  {
    id: "03",
    name: "Chirped piecewise blend",
    screenshot: "000256",
    category: "modulation",
    expression:
      "{ sin(pi * ((x + 16) mod 32) / 5) * (1 - 2 * (((((x + 16) mod 32) - 10) * ((x + 16) mod 32) / 7) mod 1)) if (x + 16) mod 32 < 15; (1 - min(1, (x + 1) / 8)) * sin(pi * x + 0.9 * sin(pi * x / 2)) + min(1, (x + 1) / 8) * (0.5 - 3 * sin(pi * ((x * sin(x) / 8) mod 1) / x)) otherwise }",
    notes: "Undefined at x = 0 in the otherwise branch; that point is a gap.",
  },
  {
    id: "04",
    name: "Three bounded decays",
    screenshot: "000308",
    category: "gaps",
    expression:
      "{ 1.08 - 2.5 * exp(-((x + 1) mod 2) / 0.02) if (x + 1) mod 2 < 0.125; -4.42 + 3.25 * exp(-(x mod 2) / 0.225) + 1.04 * sin(31.4 * (x mod 2)) if x mod 2 < 1; -4.42 + 3.25 * exp(-((x + 0.5) mod 16) / 0.225) + 1.04 * sin(31.4 * ((x + 0.5) mod 16)) if (x + 0.5) mod 16 < 0.5 }",
  },
  {
    id: "05",
    name: "Growing folded spikes",
    screenshot: "000349",
    category: "contours",
    expression: "0.5 * x * triangle(x)^2 * triangle(x * triangle(x))^2",
    notes: "triangle(t) exactly abbreviates 4*abs(t-floor(t+3/4)+1/4)-1.",
  },
  {
    id: "06",
    name: "Stepped hyperbolic bends",
    screenshot: "000401",
    category: "steps",
    expression:
      "floor(2 * triangle(x) + 2) + arctan(sinh(6 * (((2 * triangle(x / 16) + 2) mod 1)) - 3)) / (2 * arctan(sinh(3))) - 1.5",
  },
  {
    id: "07",
    name: "Three rounded arches",
    screenshot: "000413",
    category: "contours",
    expression:
      "1.25 * sqrt(max(0, 1 - 6.25 * (x mod 3 - 0.58)^2)) + 3.85 * sqrt(max(0, 1 - 5.41 * (x mod 3 - 1.5)^2)) + 1.25 * sqrt(max(0, 1 - 6.25 * (x mod 3 - 2.42)^2)) - 4",
  },
  {
    id: "08",
    name: "Sparse decay fills",
    screenshot: "000423",
    category: "gaps",
    expression:
      "{ -2.34 + 1.88 * exp(-15.4 * ((x + 8) mod 16)) + 0.938 * sin(31.4 * ((x + 8) mod 16)) if (x + 8) mod 16 < 0.25; 1.98 + 1.25 * exp(-50 * ((x + 1) mod 2)) if (x + 1) mod 2 < 0.125; 1.98 + 1.25 * exp(-50 * ((x + 0.5) mod 8)) if (x + 0.5) mod 8 < 0.125; -4.69 + 2.5 * exp(-8.7 * (x mod 2)) if x mod 2 < 1 }",
  },
  {
    id: "09",
    name: "Sawtooth section changes",
    screenshot: "000439",
    category: "cases",
    expression:
      "{ 2.5 - 5 * (5 * x mod 1) if floor(x) mod 16 == 0; 2.3 - 4.6 * (x mod 1) if (-2 <= x < 0) or (14 <= x < 16); 2.3 - 4.6 * (x / 2 mod 1) otherwise }",
  },
  {
    id: "10",
    name: "Sine ratio asymptotes",
    screenshot: "000450",
    category: "contours",
    expression: "1.2 * sin(x / 2) / sin(1.2 * x)",
    notes: "Poles are clipped by the view; undefined values are silent.",
  },
  {
    id: "11",
    name: "Double-folded harmonic peaks",
    screenshot: "000505",
    category: "harmonics",
    expression: `4.8 * (1 - abs(2 * (1 - abs(2 * (${harmonics}) - 1)) - 1)) - 2.4`,
  },
  {
    id: "12",
    name: "Hyperbolic sine packet",
    screenshot: "000518",
    category: "envelopes",
    expression: "sin(6 * x) / cosh(x / 2)",
  },
  {
    id: "13",
    name: "Triangle harmonics and steps",
    screenshot: "000537",
    category: "harmonics",
    expression: `0.85 * ${tri("x / 8")} + 0.6 * ${tri("3 * x / 8")} + 0.4 * ${tri("5 * x / 8")} + 0.26 * ${tri("7 * x / 8")} + 0.4 * (floor(6 * (x / 8 mod 1)) - 2.5)`,
  },
  {
    id: "14",
    name: "Three-against-five triangles",
    screenshot: "000550",
    category: "harmonics",
    expression: `1.4 * ${tri("x / 3")} + ${tri("x / 5")}`,
  },
  {
    id: "15",
    name: "Stepped decay arches",
    screenshot: "000625",
    category: "envelopes",
    expression:
      "3.2 * exp(-0.5 * floor(x mod 4)) * (1 - (2 * (x mod 1) - 1)^2) - 1.6",
  },
  {
    id: "16",
    name: "Decay with fast ripples",
    screenshot: "000637",
    category: "envelopes",
    expression: "6 * exp(-3 * (x mod 4)) - 3 + 0.4 * sin(20 * (x mod 6))",
  },
  {
    id: "17",
    name: "Pulse, hold and ramp",
    screenshot: "000653",
    category: "cases",
    expression:
      "{ 3 * (1 - 2 * floor(2 * (6 * x mod 1))) if x mod 2 < 0.5; -1.2 if x mod 2 < 1.2; 2.2 * 2 * (2 * x - floor(2 * x + 0.5)) otherwise }",
  },
  {
    id: "18",
    name: "Root and rational branches",
    screenshot: "000809",
    category: "cases",
    expression:
      "{ sqrt(abs(x)) / 2 - 1 if x mod 4 < 2; (x^2 + 1) / (3 * x) otherwise }",
  },
  {
    id: "19",
    name: "Nested sine modulation",
    screenshot: "000819",
    category: "modulation",
    expression: "2.8 * sin(5 * sin(4 * sin(3 * sin(2 * sin(x)))))",
  },
  {
    id: "20",
    name: "Descending stepped fills",
    screenshot: "000836",
    category: "cases",
    expression:
      "{ 1.73 * floor(1.5 * (x mod 2)) - 2.3 * (x mod 2) if x mod 16 < 2; 0.6 - 2 * (x mod 2) otherwise }",
  },
  {
    id: "21",
    name: "Reciprocal",
    screenshot: "000848",
    category: "contours",
    expression: "1 / x",
    notes:
      "x = 0 is undefined. The asymptote is clipped rather than flattening the rest of the graph.",
  },
  {
    id: "22",
    name: "Changing pulse widths",
    screenshot: "000859",
    category: "rhythms",
    expression:
      "3 * (1 - min(1, floor((x mod 1) / (0.15 + 0.25 * (floor(x) mod 3))))) - 1.5",
  },
  {
    id: "23",
    name: "Rectified decay melody",
    screenshot: "000909",
    category: "envelopes",
    expression: "5 * exp(-(x mod 4)) * abs(sin(2.2 * (x mod 5))) - 2",
  },
  {
    id: "24",
    name: "Pulse accents and saw fills",
    screenshot: "000920",
    category: "cases",
    expression:
      "{ 2.6 * (1 - 2 * floor(2 * (9 * x mod 1))) if floor(x) mod 16 == 0; 1.7 * 2 * (4 * x - floor(4 * x + 0.5)) if floor(x) mod 4 == 0; 0.9 - 1.8 * frac(x) otherwise }",
  },
  {
    id: "25",
    name: "Dense nested triangle folds",
    screenshot: "000930",
    category: "modulation",
    expression: "2.7 * triangle(3 * triangle(2 * triangle(x)))",
    notes:
      "The compact triangle helper is algebraically identical to the repeated floor/abs formula.",
  },
];

export function randomReferenceEquation(
  reference: ReferenceEquation,
  pick: <T>(values: readonly T[]) => T,
) {
  const source = reference.randomExpression ?? reference.expression;
  // Include the faithful formula, plus time-stretched/shifted variations.
  const rate = pick([1, 1, 0.5, 2, 4]),
    phase = pick([0, 0, 0.25, 0.5]);
  if (rate === 1 && phase === 0) return source;
  return source.replace(/\bx\b/g, `(${rate} * x${phase ? ` + ${phase}` : ""})`);
}
