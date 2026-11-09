import { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { typst_lezer } from "codemirror-lang-typst/lezer";
import type { Ref } from "react";
import { EditorFrame } from "./EditorFrame";
import { editorTheme } from "./editor-theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  editorRef?: Ref<ReactCodeMirrorRef>;
};

export function SourceEditor({ value, onChange, editorRef }: Props) {
  const scheme = useComputedColorScheme("light");
  return (
    <EditorFrame>
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={onChange}
        theme={scheme}
        height="100%"
        // The wrapper must be bounded too, otherwise the editor grows with its content
        // instead of scrolling internally.
        style={{ height: "100%" }}
        extensions={[typst_lezer(), EditorView.lineWrapping, editorTheme]}
        // Typst syntax highlighting + completion of built-in functions, symbols and parameters.
        basicSetup={{ foldGutter: true, autocompletion: true }}
        aria-label="Typst kodi"
      />
    </EditorFrame>
  );
}
