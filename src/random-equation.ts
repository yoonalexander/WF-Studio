// Bounded functions keep every generated curve audible and in the graph frame.
export function randomEquation(current: string): string {
  const integer = (min: number, max: number) =>
    min + Math.floor(Math.random() * (max - min + 1));
  const generate = () => {
    const amplitude = integer(2, 8),
      rate = integer(1, 4);
    const wave = `x * pi * ${rate} / 2`;
    const families = [
      () => `${amplitude} * sin(${wave})`,
      () => `${amplitude} * cos(${wave})`,
      () =>
        `${amplitude} * sin(${wave}) + ${integer(1, 3)} * cos(x * pi * ${integer(1, 4)})`,
      () => `${amplitude} * tanh(${integer(1, 3)} * sin(${wave}))`,
      () => `${amplitude} * (2 * abs(sin(${wave})) - 1)`,
      () => `${amplitude} * sin(${wave}) * cos(x * pi / ${integer(2, 4)})`,
      () => `${amplitude} * (2 * frac(x / ${integer(1, 4)}) - 1)`,
      () =>
        `{ ${amplitude} * sin(${wave}) if x mod ${integer(2, 4)} < 1; ${integer(2, 6)} * cos(x * pi) otherwise }`,
      () =>
        `{ 3 * (1 - 2 * floor(2 * (${integer(4, 8)} * x mod 1))) if x mod 2 < 0.5; -1.2 if x mod 2 < 1.2; 2.2 * 2 * (2 * x - floor(2 * x + 0.5)) otherwise }`,
      () =>
        `{ 1.73 * floor(1.5 * (x mod 2)) - 2.3 * (x mod 2) if x mod ${integer(4, 16)} < 2; 0.6 - 2 * (x mod 2) otherwise }`,
      () =>
        `{ ${amplitude} * sin(${wave}) if -${integer(1, 3)} <= x < 0; ${integer(2, 6)} * cos(x * pi) if 1 <= x < 3 }`,
      () =>
        `${amplitude} * cos(${wave}) { -${integer(1, 3)} <= x <= ${integer(1, 3)} }`,
    ];
    return families[integer(0, families.length - 1)]();
  };
  // A repeated draw must still cause an edit (and fresh graph sampling).
  for (let attempt = 0; attempt < 8; attempt++) {
    const expression = generate();
    if (expression !== current) return expression;
  }
  return current === "4 * cos(x * pi)" ? "4 * sin(x * pi)" : "4 * cos(x * pi)";
}
