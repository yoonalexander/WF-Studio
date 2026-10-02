import { parse } from "mathjs";
import type { MathNode } from "mathjs";
import type { Track } from "./model";

export const helpers = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
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
export const mod = (a: number, b: number) => ((a % b) + b) % b;
export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));
type Value = number | boolean;
type Budget = { left: number; depth: number };
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
};
export interface MathEngine {
  errors: Record<string, string>;
  value: (id: string, x: number) => number;
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
  return text;
}
const unary: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
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
};
export function createMathEngine(tracks: Track[], beatsPerBar = 4): MathEngine {
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
      tex[t.id] = tree.toTex();
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
        const c = compile(n.condition!),
          a = compile(n.trueExpr!),
          d = compile(n.falseExpr!);
        fn = (x, b) => (c(x, b) ? a(x, b) : d(x, b));
      } else if (n.type === "OperatorNode") {
        const a = n.args!.map(compile);
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
        fn = (x, b) => {
          if (f === "piecewise") {
            for (let i = 0; i < a.length - 1; i += 2)
              if (a[i](x, b)) return a[i + 1](x, b);
            return a[a.length - 1](x, b);
          }
          const v = a.map((arg) => Number(arg(x, b)));
          if (named.has(f)) return evaluators.get(named.get(f)!.id)!(v[0], b);
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
            case "pulse":
              return mod(x - (v[2] ?? 0), v[0]) < v[1] ? 1 : 0;
            case "sequence":
            case "step":
              return v[mod(Math.floor(x), v.length)];
            case "beat":
              return mod(x, v[0]);
            case "bar":
              return mod(x, v[0] * beatsPerBar);
            case "quantize":
              return Math.round(v[0] / v[1]) * v[1];
            case "scale":
              return v[3] + ((v[0] - v[1]) / (v[2] - v[1])) * (v[4] - v[3]);
            case "noise":
            case "random":
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
  return {
    errors,
    tex,
    value: (id, x) => {
      try {
        const result = Number(
          evaluators.get(id)?.(x, { left: 2048, depth: 0 }),
        );
        return Number.isFinite(result) && Math.abs(result) < 1e9 ? result : NaN;
      } catch {
        return NaN;
      }
    },
  };
}
