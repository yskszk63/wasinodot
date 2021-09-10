import * as React from "react";
import {EditorState, EditorView, basicSetup} from "@codemirror/basic-setup";
import {keymap} from "@codemirror/view";
import {indentWithTab} from "@codemirror/commands";
import {linter, openLintPanel} from "@codemirror/lint";

interface Props {
    onTextChanged?: (text: string) => any,
    text?: string,
    errorMessage?: string | null,
}

function Editor({text, onTextChanged, errorMessage}: Props) {
    const element = React.useRef<HTMLDivElement>(null);

    const handler = React.useCallback((text) => {
        if (onTextChanged) {
            onTextChanged(text);
        }
    }, [onTextChanged]);

    const [initialText] = React.useState(text);
    const diagnostics = React.useRef<string | null | undefined>(null);
    React.useEffect(() => {
        diagnostics.current = errorMessage;
    }, [errorMessage]);

    const state = React.useMemo(() => {
        return EditorState.create({
            doc: initialText,
            extensions: [
                basicSetup,
                keymap.of([indentWithTab]),
                EditorView.updateListener.of(val => {
                    if (!val.changes.empty) {
                        const text = Array.from(val.state.doc).join("");
                        handler(text);
                    }
                }),
                EditorView.theme({
                    '&': {
                        'height': '100%',
                    },
                }),
                linter(view => {
                    if (diagnostics.current) {
                        const { from, to } = view.visibleRanges[0];
                        return [
                            {
                                from,
                                to,
                                severity: 'error',
                                message: diagnostics.current,
                            }
                        ];
                    } else {
                        return [];
                    }
                }),
            ]
        });
    }, [initialText, handler, diagnostics]);

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
        return () => view.destroy();
    }, [element, state]);

    return <><div ref={element} /></>;
}

export default Editor;
