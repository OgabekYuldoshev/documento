import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { editorTheme } from "./editor-theme";

const LANGUAGES: Record<string, () => Extension> = {
  bash: () => StreamLanguage.define(shell),
  javascript: () => javascript(),
  python: () => python(),
};

const frameTheme = EditorView.theme({
  "&": { height: "auto", borderRadius: "var(--mantine-radius-md)" },
  ".cm-scroller": { overflow: "auto" },
});

type Props = { code: string; language: string };

/** Read-only, syntax highlighted code listing. */
export function CodeBlock({ code, language }: Props) {
  const scheme = useComputedColorScheme("light");
  const lang = LANGUAGES[language]?.();
  return (
    <div
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: "var(--mantine-radius-md)",
        overflow: "hidden",
      }}
    >
      <CodeMirror
        value={code}
        theme={scheme}
        editable={false}
        readOnly
        extensions={[...(lang ? [lang] : []), editorTheme, frameTheme]}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
}
