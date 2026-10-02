import { useState } from "react";
import { Plus, X } from "lucide-react";
import { readCases, writeCases } from "../bounds";
import type { EquationCase } from "../bounds";

export function BoundsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [rows, setRows] = useState<EquationCase[]>(() => {
    try {
      return (
        readCases(value) ?? [
          { expression: value, condition: "x < 0" },
          { expression: `-(${value})`, condition: "", otherwise: true },
        ]
      );
    } catch {
      return [{ expression: "sin(x)", condition: "-2 <= x < 2" }];
    }
  });
  const change = (next: EquationCase[]) => {
    setRows(next);
    onChange(writeCases(next));
  };
  const fallback = rows.at(-1)?.otherwise;
  return (
    <div className="bounds-editor" role="group" aria-label="Equation bounds">
      <div className="bounds-rows">
        {rows.map((row, i) => (
          <div className="bounds-row" key={i}>
            <input
              aria-label={`Branch ${i + 1} expression`}
              value={row.expression}
              placeholder="sin(x)"
              autoFocus={i === 0}
              onChange={(e) =>
                change(
                  rows.map((r, index) =>
                    index === i ? { ...r, expression: e.target.value } : r,
                  ),
                )
              }
            />
            {i === rows.length - 1 && fallback ? (
              <span>otherwise</span>
            ) : (
              <>
                <span>if</span>
                <input
                  aria-label={`Branch ${i + 1} bound`}
                  value={row.condition}
                  placeholder="-2 <= x < 2"
                  onChange={(e) =>
                    change(
                      rows.map((r, index) =>
                        index === i ? { ...r, condition: e.target.value } : r,
                      ),
                    )
                  }
                />
              </>
            )}
            <button
              aria-label={`Remove branch ${i + 1}`}
              title="Remove branch"
              disabled={rows.length === 1}
              onClick={() => change(rows.filter((_, index) => index !== i))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="bounds-tools">
        <button
          disabled={rows.length >= 8}
          onClick={() => {
            const next = [...rows];
            next.splice(fallback ? rows.length - 1 : rows.length, 0, {
              expression: "sin(x)",
              condition: "0 <= x < 2",
            });
            change(next);
          }}
        >
          <Plus size={12} /> Add branch
        </button>
        {!fallback && (
          <button
            disabled={rows.length >= 8}
            onClick={() =>
              change([
                ...rows,
                { expression: "0", condition: "", otherwise: true },
              ])
            }
          >
            Add otherwise
          </button>
        )}
        <span>First matching bound plays. Outside all bounds is silent.</span>
      </div>
    </div>
  );
}
