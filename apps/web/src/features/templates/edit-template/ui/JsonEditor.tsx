import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror from "@uiw/react-codemirror";
import { EditorFrame } from "./EditorFrame";
import { editorTheme } from "./editor-theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

/** CodeMirror JSON editor (schema and sample data); fills its parent's remaining height. */
export function JsonEditor({ value, onChange, label }: Props) {
  const scheme = useComputedColorScheme("light");
  return (
    <EditorFrame>
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={scheme}
        height="100%"
        extensions={[json(), EditorView.lineWrapping, editorTheme]}
        basicSetup={{ foldGutter: true, autocompletion: false }}
        aria-label={label}
      />
    </EditorFrame>
  );
}
