import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import { basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { linter, openLintPanel } from "@codemirror/lint";
import { dot } from "cm-lang-dot";
import { darcula, vscodeLight } from "@uiw/codemirror-themes-all";

type UseEditorStateInput = {
  text: string;
  errorMessage: string | null;
  themeRef: MutableRefObject<Compartment | null>;
  onTextChanged: (text: string) => void;
}

function useEditorState({ text, errorMessage, themeRef, onTextChanged }: UseEditorStateInput): EditorState | undefined {
  const [state, setState] = useState<EditorState | undefined>();
  const initialText = useRef(text);

  const diagnostics = useRef<string | null>(null);
  useImperativeHandle<string | null, string | null>(diagnostics, () => errorMessage, [errorMessage]);

  const onTextChangedRef = useRef<((text: string) => void) | null>(null);
  useImperativeHandle(onTextChangedRef, () => onTextChanged, [onTextChanged]);

  useEffect(() => {
    themeRef.current ??= new Compartment();

    const state = EditorState.create({
      doc: initialText.current,
      extensions: [
        basicSetup,
        dot(),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((val) => {
          if (val.changes.empty || onTextChangedRef.current === null) {
            return;
          }

          const text = val.state.doc.toString();
          onTextChangedRef.current(text);
        }),
        EditorView.theme({
          "&": {
            "height": "100%",
          },
        }),
        linter((view) => {
          if (diagnostics.current === null || view.visibleRanges.length === 0) {
            return [];
          }

          const { from, to } = view.visibleRanges[0];
          return [
            {
              from,
              to,
              severity: "error",
              message: diagnostics.current,
            },
          ];
        }),
        themeRef.current.of([]),
      ],
    });
    setState(state);
  }, [themeRef]);

  return state;
}

interface Props {
  onTextChanged?: (text: string) => void;
  text?: string;
  errorMessage?: string | null;
  darkTheme?: boolean | null;
  className?: string;
}

function Editor({ text, onTextChanged, errorMessage, darkTheme, className }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const themeRef = useRef<Compartment | null>(null);

  const state = useEditorState({
    text: text ?? "",
    onTextChanged: onTextChanged ?? (() => {}),
    errorMessage: errorMessage ?? null,
    themeRef,
  });

  const [view, setView] = useState<EditorView | null>(null);

  useEffect(() => {
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
  }, [state]);

  useEffect(() => {
    if (themeRef.current === null) {
      throw new Error();
    }

    if (!view) {
      return;
    }

    view.dispatch({
      effects: themeRef.current.reconfigure((darkTheme ?? false) ? darcula : vscodeLight),
    });
  }, [view, darkTheme]);

  return <div ref={element} className={className} />;
}

export default Editor;
