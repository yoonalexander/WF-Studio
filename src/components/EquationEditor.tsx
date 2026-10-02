import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import {
  bracketMatching,
  StreamLanguage,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { helpers } from "../math";
const language = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/\d+(\.\d+)?/)) return "number";
    if (stream.match(/\b(?:and|or|not|mod|piecewise)\b/)) return "keyword";
    if (stream.match(/[A-Za-z_][A-Za-z0-9_]*/)) return "variableName";
    if (stream.match(/[+*/^<>=!-]+/)) return "operator";
    stream.next();
    return null;
  },
});
export function EquationEditor({
  value,
  onChange,
  symbols,
  simple = false,
}: {
  value: string;
  onChange: (v: string) => void;
  symbols: string[];
  simple?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | undefined>(undefined),
    change = useRef(onChange),
    syncing = useRef(false);
  change.current = onChange;
  useEffect(() => {
    if (!root.current) return;
    const editor = new EditorView({
      parent: root.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...(simple ? [] : [lineNumbers()]),
          highlightActiveLine(),
          history(),
          language,
          syntaxHighlighting(defaultHighlightStyle),
          bracketMatching(),
          autocompletion({
            override: [
              (context) => {
                const word = context.matchBefore(/[\w]*/);
                if (!word || (!context.explicit && word.from === word.to))
                  return null;
                return {
                  from: word.from,
                  options: [...helpers, ...symbols, "x", "pi", "e"].map(
                    (label) => ({
                      label,
                      type: helpers.includes(label) ? "function" : "variable",
                    }),
                  ),
                };
              },
            ],
          }),
          keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": "Equation expression",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !syncing.current)
              change.current(update.state.doc.toString());
          }),
          EditorView.theme({
            "&": {
              backgroundColor: "transparent",
              color: "var(--text)",
              fontSize: "15px",
            },
            ".cm-content": { fontFamily: "var(--mono)", padding: "14px 0" },
            ".cm-gutters": {
              backgroundColor: "transparent",
              color: "var(--muted)",
              border: "none",
            },
            ".cm-activeLine, .cm-activeLineGutter": {
              backgroundColor: "transparent",
            },
            ".cm-cursor": { borderLeftColor: "var(--accent)" },
            ".cm-tooltip": {
              backgroundColor: "#252d3c",
              color: "#edf2f7",
              border: "1px solid #435069",
            },
            "&.cm-focused": { outline: "none" },
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = undefined;
    };
    // A track selection remounts this editor. External edits are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join("|"), simple]);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      syncing.current = true;
      try {
        v.dispatch({
          changes: { from: 0, to: v.state.doc.length, insert: value },
        });
      } finally {
        syncing.current = false;
      }
    }
  }, [value]);
  return <div className="equation-editor" ref={root} />;
}
