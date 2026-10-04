export interface EquationCase {
  expression: string;
  condition: string;
  otherwise?: boolean;
}

// Expand the one-frame preview for explicit numeric bounds outside [-4, 4].
// This only chooses a viewport; the restricted evaluator still validates input.
export function previewExtent(text: string) {
  const number = "(-?\\d+(?:\\.\\d+)?)";
  const matches = [
    ...text.matchAll(new RegExp(`\\bx\\s*(?:<=|>=|<|>)\\s*${number}`, "g")),
    ...text.matchAll(new RegExp(`${number}\\s*(?:<=|>=|<|>)\\s*x\\b`, "g")),
  ];
  return Math.min(
    64,
    Math.max(4, ...matches.map((m) => Math.ceil(Math.abs(Number(m[1]))))),
  );
}

// This syntax is translated to the same restricted AST as ordinary equations.
// It never executes strings or bypasses the engine's validation/work limits.
export function readCases(text: string): EquationCase[] | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return;
  const body = trimmed.slice(1, -1);
  const entries: string[] = [];
  let start = 0,
    depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "(") depth++;
    if (body[i] === ")") depth--;
    if ((body[i] === ";" || body[i] === "\n") && depth === 0) {
      if (body.slice(start, i).trim())
        entries.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (body.slice(start).trim()) entries.push(body.slice(start).trim());
  if (!entries.length || entries.length > 15)
    throw new Error("Use 1–15 bounded branches.");
  return entries.map((entry, i) => {
    const fallback = entry.match(/^([\s\S]*?)\s+otherwise$/);
    if (fallback) {
      if (i !== entries.length - 1) throw new Error("Put otherwise last.");
      return { expression: fallback[1].trim(), condition: "", otherwise: true };
    }
    const branch = entry.match(/^([\s\S]*?)\s*\bif(?:\s+([\s\S]*))?$/);
    if (!branch)
      throw new Error(
        "Write each branch as: expression if condition; end with expression otherwise if needed.",
      );
    return {
      expression: branch[1].trim(),
      condition: (branch[2] ?? "").trim(),
      otherwise: false,
    };
  });
}

export function writeCases(cases: EquationCase[]) {
  return `{\n${cases.map((c) => `  ${c.expression} ${c.otherwise ? "otherwise" : `if ${c.condition}`}`).join(";\n")}\n}`;
}

export function boundedSource(text: string) {
  const cases = readCases(text);
  if (cases) {
    if (cases.some((c) => !c.expression))
      throw new Error("Enter an expression for each branch.");
    if (cases.some((c) => !c.otherwise && !c.condition))
      throw new Error("Enter a condition for each bound.");
    const fallback = cases.at(-1)!.otherwise
      ? cases.at(-1)!.expression
      : "0 / 0";
    const branches = cases.filter((c) => !c.otherwise);
    if (!branches.length) return fallback;
    return `piecewise(${branches.map((c) => `(${c.condition}), (${c.expression})`).join(", ")}, (${fallback}))`;
  }
  // Calculator-style domain restriction, e.g. sin(x) { -2 <= x < 2 }.
  const restricted = text.match(/^([\s\S]+?)\s*\{([^{}]+)\}\s*$/);
  if (restricted) return `bounded((${restricted[1]}), (${restricted[2]}))`;
  return text;
}
