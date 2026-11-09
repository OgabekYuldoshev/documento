import { EditorView } from "@codemirror/view";

/** Aligns CodeMirror with the app surfaces so editors do not look like a foreign widget. */
export const editorTheme = EditorView.theme({
  "&": { backgroundColor: "var(--app-surface)", height: "100%" },
  ".cm-gutters": {
    backgroundColor: "var(--app-subtle)",
    borderRight: "1px solid var(--app-border)",
    color: "var(--mantine-color-dimmed)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--app-subtle)" },
  ".cm-scroller": { fontFamily: "var(--mantine-font-family-monospace)", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
});
