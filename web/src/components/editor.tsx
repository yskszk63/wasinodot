import * as React from "react";
import {EditorState, EditorView, basicSetup} from "@codemirror/basic-setup"
import {keymap} from "@codemirror/view"
import {indentWithTab} from "@codemirror/commands"

interface Props {
    onTextChanged?: (text: string) => any,
    text?: string,
}

interface State {
    element: React.RefObject<HTMLDivElement>,
    editorState: EditorState,
}

class Editor extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        const element = React.createRef<HTMLDivElement>();
        const onTextChanged = props.onTextChanged || (() => {});

        this.state = {
            element,
            editorState: EditorState.create({
                doc: props.text,
                extensions: [
                    basicSetup,
                    keymap.of([indentWithTab]),
                    EditorView.updateListener.of(val => {
                        const text = Array.from(val.state.doc).join("");
                        onTextChanged(text);
                    }),
                    EditorView.theme({
                        '&': {
                            'height': '100%',
                        },
                    }),
                ]
            }),
        };
    }

    componentDidMount() {
        const element = this.state.element.current;
        if (!element) {
            throw new Error("element not initialized.");
        }
        new EditorView({
            state: this.state.editorState,
            parent: element,
        });
    }

    render() {
        return <><div ref={this.state.element} /></>;
    }
}

export default Editor;
