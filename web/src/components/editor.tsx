import * as React from "react";
import { basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { linter, openLintPanel } from "@codemirror/lint";
import { dot } from "cm-lang-dot";
import { darcula, vscodeLight } from "@uiw/codemirror-themes-all";

interface Props {
  onTextChanged?: (text: string) => any;
  text?: string;
  errorMessage?: string | null;
  darkTheme?: boolean | null;
  className?: string;
}

function Editor({ text, onTextChanged, errorMessage, darkTheme, className }: Props) {
  const element = React.useRef<HTMLDivElement>(null);

  const handler = React.useCallback((text: string) => {
    if (onTextChanged) {
      onTextChanged(text);
    }
  }, [onTextChanged]);

  const [initialText] = React.useState(text);
  const diagnostics = React.useRef<string | null | undefined>(null);
  React.useEffect(() => {
    diagnostics.current = errorMessage;
  }, [errorMessage]);

  const [theme] = React.useState(() => new Compartment());
  const state = React.useMemo(() => {
    return EditorState.create({
      doc: initialText,
      extensions: [
        basicSetup,
        dot(),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((val) => {
          if (!val.changes.empty) {
            const text = Array.from(val.state.doc).join("");
            handler(text);
          }
        }),
        EditorView.theme({
          "&": {
            "height": "100%",
          },
        }),
        linter((view) => {
          if (diagnostics.current && view.visibleRanges.length) {
            const { from, to } = view.visibleRanges[0];
            return [
              {
                from,
                to,
                severity: "error",
                message: diagnostics.current,
              },
            ];
          } else {
            return [];
          }
        }),
        theme.of([]),
      ],
    });
  }, [initialText, handler, diagnostics, theme]);

  const [view, setView] = React.useState<EditorView | null>(null);
  React.useEffect(() => {
    if (!element.current) {
      throw new Error("element not initialized.");
    }
    const view = new EditorView({
      state,
      parent: element.current,
    });
    openLintPanel(view);
    view.focus();
    setView(view);
    return () => {
      view.destroy();
      setView(null);
    }
  }, [element, state, setView]);
  React.useEffect(() => {
    if (!view) {
      return;
    }

    view.dispatch({
      effects: theme.reconfigure((darkTheme ?? false) ? darcula : vscodeLight),
    });
  }, [view, darkTheme, theme]);

  return (
    <>
      <div ref={element} className={className} />
    </>
  );
}

export default Editor;
