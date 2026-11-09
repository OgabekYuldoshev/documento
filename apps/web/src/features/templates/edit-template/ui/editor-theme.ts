import { EditorView } from "@codemirror/view";
import { Prec } from "@uiw/react-codemirror";

/** Aligns CodeMirror with the app surfaces so editors do not look like a foreign widget. */
const theme = EditorView.theme({
  "&": { backgroundColor: "var(--app-surface)", height: "100%" },
  ".cm-gutters": {
    backgroundColor: "var(--app-subtle)",
    borderRight: "1px solid var(--app-border)",
    color: "var(--mantine-color-dimmed)",
  },
  // Translucent: the selection layer sits under the line, an opaque fill would hide it.
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, currentColor 6%, transparent)",
  },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in srgb, var(--mantine-color-brand-filled) 38%, transparent)" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--mantine-font-family-monospace)",
    fontSize: "13px",
  },
  "&.cm-focused": { outline: "none" },
});

// Highest precedence so it beats the built-in light/dark theme backgrounds.
export const editorTheme = Prec.highest(theme);
