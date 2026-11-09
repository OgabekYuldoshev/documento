import { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
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
        extensions={[EditorView.lineWrapping, editorTheme]}
        basicSetup={{ foldGutter: false, autocompletion: false }}
        aria-label="Typst kodi"
      />
    </EditorFrame>
  );
}
