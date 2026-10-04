import { parse } from "mathjs";
import type { MathNode } from "mathjs";
import type { Track } from "./model";
import { boundedSource } from "./bounds";

export const helpers = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "abs",
  "sqrt",
  "exp",
  "ln",
  "log",
  "floor",
  "ceil",
  "round",
  "min",
  "max",
  "sign",
  "clamp",
  "mod",
  "frac",
  "beat",
  "bar",
  "pulse",
  "step",
  "sequence",
  "noise",
  "random",
  "quantize",
  "scale",
  "piecewise",
  "bounded",
  "triangle",
];
const reserved = new Set([
  ...helpers,
  "x",
  "pi",
  "e",
  "true",
  "false",
  "constructor",
  "__proto__",
  "prototype",
]);
export const validSymbol = (s: string) =>
  /^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(s) && !reserved.has(s);
export const mod = (a: number, b: number) => {
  const remainder = a % b;
  // Avoid adding/subtracting the divisor for already-positive remainders:
  // that used to move 0.15 below a 0.15 pulse boundary through roundoff.
  return remainder === 0 ? 0 : remainder / b < 0 ? remainder + b : remainder;
};
export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));
type Value = number | boolean;
type Budget = { left: number; depth: number; branch: string };
type Eval = (x: number, budget: Budget) => Value;
type Node = MathNode & {
  value?: unknown;
  name?: string;
  op?: string;
  fn?: string | MathNode;
  args?: MathNode[];
  content?: MathNode;
  condition?: MathNode;
  trueExpr?: MathNode;
  falseExpr?: MathNode;
  conditionals?: string[];
  params?: MathNode[];
};
export interface MathEngine {
  errors: Record<string, string>;
  value: (id: string, x: number) => number;
  sample: (id: string, x: number) => { value: number; branch: string };
  tex: Record<string, string>;
}

function source(track: Track): string {
  let text = track.expression.trim();
  const declaration = text.match(
    /^([A-Za-z][A-Za-z0-9_]*)\s*\(\s*x\s*\)\s*=([^=][\s\S]*)$/,
  );
  if (declaration) {
    if (declaration[1] !== track.symbol)
      throw new Error(`Use ${track.symbol}(x), or change the function name.`);
    text = declaration[2];
  }
  const conditional = text.match(/^if\s+(.+?)\s+then\s+(.+?)\s+else\s+(.+)$/);
  if (conditional)
    text = `(${conditional[1]}) ? (${conditional[2]}) : (${conditional[3]})`;
  return boundedSource(text);
}
const relations: Record<string, (a: Value, b: Value) => boolean> = {
  smaller: (a, b) => a < b,
  smallerEq: (a, b) => a <= b,
  larger: (a, b) => a > b,
  largerEq: (a, b) => a >= b,
  equal: (a, b) => a === b,
  unequal: (a, b) => a !== b,
};

function equationTex(tree: MathNode): string {
  const options = {
    handler: (node: MathNode): string | undefined => {
      const n = node as Node;
      const tex = (child: MathNode): string => {
        while (child.type === "ParenthesisNode")
          child = (child as Node).content!;
        return child.toTex(options);
      };
      if (n.type === "FunctionNode" && (n.fn as Node).name === "piecewise") {
        const args = n.args!;
        const rows: string[] = [];
        for (let i = 0; i < args.length - 1; i += 2)
          rows.push(`${tex(args[i + 1])} & \\text{if } ${tex(args[i])}`);
        // An omitted otherwise branch is undefined, not the note y = 0.
        if (args.at(-1)!.toString({ parenthesis: "auto" }) !== "0 / 0")
          rows.push(`${tex(args.at(-1)!)} & \\text{otherwise}`);
        return `\\begin{cases}${rows.join(" \\\\ ")}\\end{cases}`;
      }
      if (n.type === "FunctionNode" && (n.fn as Node).name === "bounded")
        return `${tex(n.args![0])}\\quad\\{${tex(n.args![1])}\\}`;
      if (n.type === "ConditionalNode")
        return `\\begin{cases}${tex(n.trueExpr!)} & \\text{if } ${tex(n.condition!)} \\\\ ${tex(n.falseExpr!)} & \\text{otherwise}\\end{cases}`;
      return undefined;
    },
  };
  return tree.toTex(options);
}
const unary: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  abs: Math.abs,
  sqrt: Math.sqrt,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  frac: (v) => mod(v, 1),
  triangle: (v) => 1 - 4 * Math.abs(mod(v + 0.25, 1) - 0.5),
};
export function createMathEngine(tracks: Track[], beatsPerBar = 4): MathEngine {
  let nextBranch = 0;
  const errors: Record<string, string> = {};
  const tex: Record<string, string> = {};
  const named = new Map<string, Track>();
  const ast = new Map<string, MathNode>();
  const deps = new Map<string, Set<string>>();
  const evaluators = new Map<string, Eval>();
  for (const t of tracks) {
    if (!validSymbol(t.symbol))
      errors[t.id] = "Choose a function name that is not a built-in function.";
    if (named.has(t.symbol)) {
      errors[t.id] = `Duplicate function: ${t.symbol}`;
      errors[named.get(t.symbol)!.id] = errors[t.id];
    }
    named.set(t.symbol, t);
  }
  for (const t of tracks) {
    if (errors[t.id]) continue;
    try {
      if (t.expression.length > 1024)
        throw new Error("Keep expressions under 1,024 characters.");
      const tree = parse(source(t));
      let count = 0;
      const dependencies = new Set<string>();
      function validate(node: MathNode, depth: number) {
        const n = node as Node;
        if (++count > 256 || depth > 32)
          throw new Error("Expression is too complex (256 nodes / 32 levels).");
        if (n.type === "ConstantNode") {
          if (typeof n.value !== "number" && typeof n.value !== "boolean")
            throw new Error("Only numbers and booleans are allowed.");
        } else if (n.type === "SymbolNode") {
          const s = n.name!;
          if (!["x", "pi", "e", "true", "false"].includes(s)) {
            if (named.has(s)) dependencies.add(s);
            else throw new Error(`Unknown value: ${s}`);
          }
        } else if (n.type === "OperatorNode") {
          if (
            ![
              "+",
              "-",
              "*",
              "/",
              "^",
              "%",
              "mod",
              "<",
              "<=",
              ">",
              ">=",
              "==",
              "!=",
              "and",
              "or",
              "not",
            ].includes(n.op!)
          )
            throw new Error(`Operator not supported: ${n.op}`);
          n.args!.forEach((a) => validate(a, depth + 1));
        } else if (n.type === "RelationalNode") {
          if (n.conditionals!.some((c) => !Object.hasOwn(relations, c)))
            throw new Error("Unsupported bound comparison.");
          n.params!.forEach((a) => validate(a, depth + 1));
        } else if (n.type === "FunctionNode") {
          const f = (n.fn as Node).name!;
          if (!helpers.includes(f) && !named.has(f))
            throw new Error(`Unknown function: ${f}`);
          if (named.has(f)) {
            dependencies.add(f);
            if (n.args!.length !== 1)
              throw new Error(`${f} takes one time argument.`);
          }
          if (n.args!.length > 32)
            throw new Error("At most 32 arguments per function.");
          const arity: Record<string, [number, number]> = {
            pulse: [2, 3],
            bounded: [2, 2],
            piecewise: [3, 31],
            sequence: [1, 32],
            step: [1, 32],
            noise: [0, 1],
            random: [0, 1],
            mod: [2, 2],
            clamp: [3, 3],
            quantize: [2, 2],
            scale: [5, 5],
            min: [1, 32],
            max: [1, 32],
            beat: [1, 1],
            bar: [1, 1],
          };
          const range = arity[f] ?? [1, 1];
          if (
            n.args!.length < range[0] ||
            n.args!.length > range[1] ||
            (f === "piecewise" && n.args!.length % 2 !== 1)
          )
            throw new Error(`Check the arguments for ${f}.`);
          n.args!.forEach((a) => validate(a, depth + 1));
        } else if (n.type === "ParenthesisNode")
          validate(n.content!, depth + 1);
        else if (n.type === "ConditionalNode") {
          validate(n.condition!, depth + 1);
          validate(n.trueExpr!, depth + 1);
          validate(n.falseExpr!, depth + 1);
        } else throw new Error(`${n.type.replace("Node", "")} is not allowed.`);
      }
      validate(tree, 0);
      ast.set(t.id, tree);
      deps.set(t.id, dependencies);
      tex[t.id] = equationTex(tree);
    } catch (e) {
      errors[t.id] = e instanceof Error ? e.message : "Invalid expression";
    }
  }
  function resolve(t: Track, path: string[]): Eval {
    if (errors[t.id]) throw new Error(errors[t.id]);
    if (path.includes(t.symbol))
      throw new Error(
        `Circular dependency: ${[...path, t.symbol].join(" → ")}`,
      );
    if (path.length >= 16)
      throw new Error("Named functions can nest at most 16 levels.");
    if (evaluators.has(t.id)) return evaluators.get(t.id)!;
    for (const s of deps.get(t.id) ?? [])
      resolve(named.get(s)!, [...path, t.symbol]);
    function compile(node: MathNode): Eval {
      const n = node as Node;
      let fn: Eval;
      if (n.type === "ConstantNode") fn = () => n.value as Value;
      else if (n.type === "SymbolNode")
        fn =
          n.name === "x"
            ? (x) => x
            : n.name === "pi"
              ? () => Math.PI
              : n.name === "e"
                ? () => Math.E
                : n.name === "true"
                  ? () => true
                  : n.name === "false"
                    ? () => false
                    : (x, b) => evaluators.get(named.get(n.name!)!.id)!(x, b);
      else if (n.type === "ParenthesisNode") fn = compile(n.content!);
      else if (n.type === "ConditionalNode") {
        const branch = nextBranch++;
        const c = compile(n.condition!),
          a = compile(n.trueExpr!),
          d = compile(n.falseExpr!);
        fn = (x, b) => {
          const choose = !!c(x, b);
          b.branch += `${branch}:${choose ? 1 : 0};`;
          return choose ? a(x, b) : d(x, b);
        };
      } else if (n.type === "RelationalNode") {
        const params = n.params!.map(compile);
        fn = (x, b) => {
          let left = params[0](x, b);
          for (let i = 0; i < n.conditionals!.length; i++) {
            const right = params[i + 1](x, b);
            if (!relations[n.conditionals![i]](left, right)) return false;
            left = right;
          }
          return true;
        };
      } else if (n.type === "OperatorNode") {
        const a = n.args!.map(compile);
        const branch = nextBranch++;
        fn = (x, b) => {
          const l = a[0](x, b);
          if (n.op === "not") return !l;
          if (n.op === "and") return !!l && !!a[1](x, b);
          if (n.op === "or") return !!l || !!a[1](x, b);
          const r = a[1]?.(x, b);
          switch (n.op) {
            case "+":
              return a.length === 1 ? +l : +l + Number(r);
            case "-":
              return a.length === 1 ? -Number(l) : Number(l) - Number(r);
            case "*":
              return Number(l) * Number(r);
            case "/":
              return Number(l) / Number(r);
            case "^":
              return Number(l) ** Number(r);
            case "%":
            case "mod":
              b.branch += `${branch}:${Math.floor(Number(l) / Number(r))};`;
              return mod(Number(l), Number(r));
            case "<":
              return l < r;
            case "<=":
              return l <= r;
            case ">":
              return l > r;
            case ">=":
              return l >= r;
            case "==":
              return l === r;
            case "!=":
              return l !== r;
            default:
              return NaN;
          }
        };
      } else {
        const f = (n.fn as Node).name!;
        const a = n.args!.map(compile);
        const branch = nextBranch++;
        fn = (x, b) => {
          if (f === "bounded") {
            const inside = !!a[1](x, b);
            b.branch += `${branch}:${inside ? 1 : 0};`;
            return inside ? a[0](x, b) : NaN;
          }
          if (f === "piecewise") {
            for (let i = 0; i < a.length - 1; i += 2)
              if (a[i](x, b)) {
                b.branch += `${branch}:${i};`;
                return a[i + 1](x, b);
              }
            b.branch += `${branch}:else;`;
            return a[a.length - 1](x, b);
          }
          const v = a.map((arg) => Number(arg(x, b)));
          if (named.has(f)) return evaluators.get(named.get(f)!.id)!(v[0], b);
          if (f === "floor" || f === "ceil" || f === "round" || f === "sign")
            b.branch += `${branch}:${unary[f](v[0])};`;
          if (f === "frac") b.branch += `${branch}:${Math.floor(v[0])};`;
          if (f === "mod") b.branch += `${branch}:${Math.floor(v[0] / v[1])};`;
          if (unary[f]) return unary[f](v[0]);
          switch (f) {
            case "min":
              return Math.min(...v);
            case "max":
              return Math.max(...v);
            case "mod":
              return mod(v[0], v[1]);
            case "clamp":
              return clamp(v[0], v[1], v[2]);
            case "pulse": {
              const on = mod(x - (v[2] ?? 0), v[0]) < v[1];
              b.branch += `${branch}:${on ? 1 : 0};`;
              return on ? 1 : 0;
            }
            case "sequence":
            case "step":
              b.branch += `${branch}:${Math.floor(x)};`;
              return v[mod(Math.floor(x), v.length)];
            case "beat":
              b.branch += `${branch}:${Math.floor(x / v[0])};`;
              return mod(x, v[0]);
            case "bar":
              b.branch += `${branch}:${Math.floor(x / (v[0] * beatsPerBar))};`;
              return mod(x, v[0] * beatsPerBar);
            case "quantize":
              b.branch += `${branch}:${Math.round(v[0] / v[1])};`;
              return Math.round(v[0] / v[1]) * v[1];
            case "scale":
              return v[3] + ((v[0] - v[1]) / (v[2] - v[1])) * (v[4] - v[3]);
            case "noise":
            case "random":
              b.branch += `${branch}:${Math.floor(x * 48)};`;
              return (
                mod(
                  Math.sin(Math.floor(x * 48) * 127.1 + (v[0] ?? 1) * 311.7) *
                    43758.5453,
                  1,
                ) *
                  2 -
                1
              );
            default:
              return NaN;
          }
        };
      }
      return (x, b) => {
        if (--b.left < 0) throw new Error("Evaluation budget exceeded.");
        return fn(x, b);
      };
    }
    const raw = compile(ast.get(t.id)!);
    const evaluate: Eval = (x, b) => {
      if (++b.depth > 16) throw new Error("Function depth exceeded.");
      try {
        return (
          Number(raw((x + t.transform.shift) * t.transform.speed, b)) *
            t.transform.gain +
          t.transform.offset
        );
      } finally {
        b.depth--;
      }
    };
    evaluators.set(t.id, evaluate);
    return evaluate;
  }
  for (const t of tracks) {
    try {
      resolve(t, []);
    } catch (e) {
      errors[t.id] = e instanceof Error ? e.message : "Invalid dependency";
    }
  }
  const sample = (id: string, x: number) => {
    const budget = { left: 2048, depth: 0, branch: "" };
    try {
      const result = Number(evaluators.get(id)?.(x, budget));
      return {
        value: Number.isFinite(result) && Math.abs(result) < 1e9 ? result : NaN,
        branch: budget.branch,
      };
    } catch {
      return { value: NaN, branch: budget.branch };
    }
  };
  return {
    errors,
    tex,
    sample,
    value: (id, x) => sample(id, x).value,
  };
}
