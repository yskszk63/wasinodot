import {EditorView} from "@codemirror/view"
import {Extension} from "@codemirror/state"
import {HighlightStyle, tags as t} from "@codemirror/highlight"
import * as ayu from "ayu";

function mktheme(scheme: ayu.Scheme): [Extension, HighlightStyle] {
  const {editor, syntax, ui, common} = scheme;
  const theme = EditorView.theme({
    "&": {
      color: editor.fg.hex(),
      backgroundColor: editor.bg.hex(),
    },

    ".cm-content": {
      caretColor: editor.selection.inactive.hex(),
    },

    "&.cm-focused .cm-cursor": {borderLeftColor: editor.selection.active.hex()},
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {backgroundColor: editor.selection.active.hex()},

    ".cm-panels": {backgroundColor: ui.bg.hex(), color: ui.fg.hex()},
    ".cm-panels.cm-panels-top": {borderBottom: `2px solid ${ui.line.hex()}`},
    ".cm-panels.cm-panels-bottom": {borderTop: `2px solid ${ui.line.hex()}`},

    ".cm-searchMatch": {
      backgroundColor: editor.findMatch.inactive.hex(),
      outline: `1px solid ${ui.line.hex()}`,
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: editor.selection.active.hex(),
    },

    ".cm-activeLine": {backgroundColor: ui.selection.active.hex()},
    ".cm-selectionMatch": {backgroundColor: ui.selection.normal.hex()},

    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      backgroundColor: "#bad0f847", // TODO
      outline: "1px solid #515a6b"
    },

    ".cm-gutters": {
      backgroundColor: editor.gutter.normal.hex(),
      color: editor.fg.hex(),
      border: "none"
    },

    ".cm-activeLineGutter": {
      backgroundColor: editor.gutter.active.hex(),
    },

    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none", // TODO
      color: "#ddd"
    },

    ".cm-tooltip": {
      border: "1px solid #181a1f", // TODO
      backgroundColor: ui.bg.hex()
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: editor.line.hex(),
        color: editor.fg.hex(),
      }
    },
    ".cm-panel.cm-panel-lint ul [aria-selected]": {
      backgroundColor: editor.line.hex(),
      color: editor.fg.hex(),
    },
  }, {dark: scheme !== ayu.light})

  const highlight = HighlightStyle.define([
    {tag: t.keyword, color: syntax.keyword.hex()},
    {tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: syntax.special.hex()},
    {tag: [t.function(t.variableName), t.labelName], color: syntax.entity.hex()},
    {tag: [t.color, t.constant(t.name), t.standard(t.name)], color: syntax.constant.hex()},
    {tag: [t.definition(t.name), t.separator], color: syntax.func.hex()},
    {tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: syntax.entity.hex()},
    {tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: syntax.operator.hex()},
    {tag: [t.meta, t.comment], color: syntax.comment.hex()},
    {tag: t.strong, fontWeight: "bold"},
    {tag: t.emphasis, fontStyle: "italic"},
    {tag: t.strikethrough, textDecoration: "line-through"},
    {tag: t.link, color: syntax.special.hex(), textDecoration: "underline"},
    {tag: t.heading, fontWeight: "bold", color: syntax.special.hex()},
    {tag: [t.atom, t.bool, t.special(t.variableName)], color: syntax.entity.hex() },
    {tag: [t.processingInstruction, t.string, t.inserted], color: syntax.string.hex()},
    {tag: t.invalid, color: common.error.hex()},
  ])

  return [theme, highlight];
}

/// Extension to enable the One Dark theme (both the editor theme and
/// the highlight style).
export const dark: Extension = mktheme(ayu.dark);
export const light: Extension = mktheme(ayu.light);
export const mirage: Extension = mktheme(ayu.mirage);
