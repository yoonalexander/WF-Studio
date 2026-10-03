type RandomSource = () => number;
type Parameters = ReturnType<typeof parameters>;

function parameters(random: RandomSource) {
  const integer = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));
  const pick = <T>(values: readonly T[]) =>
    values[integer(0, values.length - 1)];
  const a = integer(4, 9),
    rate = pick([1, 2, 3, 4]),
    phase = pick([0, 0.25, 0.5, 0.75]),
    period = pick([1, 2, 4]);
  return {
    a,
    rate,
    period,
    integer,
    pick,
    depth: integer(2, 5),
    decay: pick([0.5, 1, 1.5, 2]),
    duty: pick([0.25, 0.5, 0.75]),
    seed: integer(1, 999),
    wave: `pi * ${rate} * x / 2${phase ? ` + ${phase} * pi` : ""}`,
    ramp: `frac(x / ${period})`,
  };
}

// Each category explores a different capability of the restricted engine.
// Avoid poles and unbounded pitch; intentional rests remain undefined gaps.
const groups: { category: string; build: ((p: Parameters) => string)[] }[] = [
  {
    category: "harmonics",
    build: [
      ({ a, wave }) =>
        `${a} * sin(${wave}) + 2 * sin(2 * (${wave})) + cos(3 * (${wave}))`,
      ({ a, wave }) =>
        `${a} * (sin(${wave}) + sin(3 * (${wave})) / 3 + sin(5 * (${wave})) / 5) / 1.5`,
      ({ a, wave }) => `${a} * sin(${wave}) * cos(pi * x / 2)`,
      ({ a, wave }) =>
        `${a} * cos(${wave}) + 3 * abs(sin(2 * (${wave}))) - 1.5`,
    ],
  },
  {
    category: "modulation",
    build: [
      ({ a, wave, depth }) => `${a} * sin(${wave} + ${depth} * sin(pi * x))`,
      ({ a, rate, period }) =>
        `${a} * sin(pi * (${rate} * beat(${period})^2 + beat(${period})))`,
      ({ a, ramp, pick }) => `${a} * sin(2 * pi * ${ramp}^${pick([2, 3, 4])})`,
      ({ a, wave }) => `${a} * sin(${wave} + pi / 2 * floor(x))`,
    ],
  },
  {
    category: "contours",
    build: [
      ({ a, ramp }) => `${a} * (2 * sqrt(max(0, 1 - (2 * ${ramp} - 1)^2)) - 1)`,
      ({ a, depth, ramp }) =>
        `${a} * atan(${depth} * (2 * ${ramp} - 1)) / atan(${depth})`,
      ({ a, depth, ramp }) =>
        `${a} * (2 * ln(1 + ${depth} * ${ramp}) / ln(${depth + 1}) - 1)`,
      ({ a, wave }) => `${a} * 2 * asin(sin(${wave})) / pi`,
    ],
  },
  {
    category: "envelopes",
    build: [
      ({ a, decay, period, wave }) =>
        `${a} * exp(-${decay} * beat(${period})) * cos(${wave})`,
      ({ a, depth, period, wave }) =>
        `${a} * exp(-${depth} * (beat(${period}) - ${period / 2})^2) * sin(${wave})`,
      ({ a, decay, ramp, wave }) =>
        `${a} * min(1, 4 * ${ramp}) * exp(-${decay} * ${ramp}) * sin(${wave})`,
      ({ a, depth, ramp }) =>
        `${a} * (2 * (1 - exp(-${depth} * ${ramp})) / (1 - exp(-${depth})) - 1)`,
    ],
  },
  {
    category: "steps",
    build: [
      ({ pick, wave }) =>
        `sequence(${pick(["0, 7, 3, 10", "0, 4, 7, 12", "-5, 2, 7, 2", "7, 3, 0, -2"])}) + 1.5 * sin(${wave})`,
      ({ a, wave, pick }) =>
        `quantize(${a} * sin(${wave}) + 2 * cos(pi * x), ${pick([1, 2, 3])})`,
      ({ a, wave }) => `clamp(ceil(${a} * sin(${wave})), -${a - 2}, ${a - 2})`,
      ({ pick }) =>
        `step(${pick(["0, 4, 7, -2", "-5, 0, 7, 3", "0, 7, 12, 7", "3, -2, 5, 0"])}) + ${pick([1, 2, 3])} * (2 * frac(x) - 1)`,
    ],
  },
  {
    category: "rhythms",
    build: [
      ({ a, period, duty, wave }) =>
        `${a} * (2 * pulse(${period}, ${duty}) - 1) + 2 * sin(${wave})`,
      ({ a, duty }) =>
        `scale(pulse(1, ${duty}) + pulse(1.5, ${duty / 2}, 0.25), 0, 2, -${a}, ${a})`,
      ({ a, wave, seed }) =>
        `${a} * sin(${wave}) * (0.35 + 0.65 * pulse(1, 0.25)) + 2 * noise(${seed})`,
      ({ a, period }) =>
        `${a} * (2 * max(0, 1 - beat(${period}) / (0.2 + 0.2 * (floor(x) mod 3))) - 1)`,
    ],
  },
  {
    category: "cases",
    build: [
      ({ rate }) =>
        `{ 3 * (1 - 2 * floor(2 * (${rate + 4} * x mod 1))) if x mod 2 < 0.5; -1.2 if x mod 2 < 1.2; 4.4 * (2 * x - floor(2 * x + 0.5)) otherwise }`,
      ({ a, wave }) =>
        `{ ${a} * sin(${wave}) if x mod 4 < 1; ${a} * (2 * frac(x) - 1) if x mod 4 < 2; quantize(${a} * cos(${wave}), 2) otherwise }`,
      ({ a, wave }) =>
        `{ ${a} * x / (1 + x^2) if x mod 4 < 2; ${a} * cos(${wave}) / (1 + abs(x)) otherwise }`,
      ({ a, depth, wave }) =>
        `{ ${a} * tanh(${depth} * sin(${wave})) if bar(1) < 2; ${a} * (2 * frac(x) - 1) otherwise }`,
    ],
  },
  {
    category: "gaps",
    build: [
      ({ a, wave, duty }) =>
        `{ ${a} * sin(${wave}) if pulse(1, ${duty}) == 1 }`,
      ({ a, wave, integer }) =>
        `${a} * cos(${wave}) { -${integer(1, 3)} <= x < ${integer(1, 3)} }`,
      ({ a, wave, depth }) =>
        `{ ${a} * tanh(${depth} * sin(${wave})) if 0 <= x < 1.5; ${a} * (1 - 2 * frac(x)) if 2.5 <= x < 4 }`,
      ({ a, wave }) =>
        `{ quantize(${a} * sin(${wave}), 2) if x mod 4 < 1; ${a} * sqrt(abs(sin(${wave}))) if 2 <= x mod 4 < 3 }`,
    ],
  },
];

export const randomEquationFamilies = groups.flatMap((group) =>
  group.build.map((build) => ({
    category: group.category,
    generate: (random: RandomSource) => build(parameters(random)),
  })),
);

export function createRandomEquationGenerator(
  random: RandomSource = () => Math.random(),
) {
  const shuffle = <T>(items: readonly T[]) => {
    const bag = [...items];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  };
  let categories: string[] = [],
    previousCategory = "";
  const families = new Map<string, typeof randomEquationFamilies>();
  const previousFamily = new Map<
    string,
    (typeof randomEquationFamilies)[number]
  >();
  return (current: string): string => {
    if (!categories.length) {
      categories = shuffle(groups.map((group) => group.category));
      if (categories.at(-1) === previousCategory)
        [categories[0], categories[categories.length - 1]] = [
          categories.at(-1)!,
          categories[0],
        ];
    }
    const category = categories.pop()!;
    previousCategory = category;
    if (!families.get(category)?.length) {
      const bag = shuffle(
        randomEquationFamilies.filter((family) => family.category === category),
      );
      if (bag.at(-1) === previousFamily.get(category))
        [bag[0], bag[bag.length - 1]] = [bag.at(-1)!, bag[0]];
      families.set(category, bag);
    }
    const family = families.get(category)!.pop()!;
    previousFamily.set(category, family);
    for (let attempt = 0; attempt < 8; attempt++) {
      const expression = family.generate(random);
      if (expression !== current) return expression;
    }
    return current === "4 * cos(pi * x)"
      ? "4 * sin(pi * x)"
      : "4 * cos(pi * x)";
  };
}

export const randomEquation = createRandomEquationGenerator();
