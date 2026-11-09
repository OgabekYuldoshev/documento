import { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror from "@uiw/react-codemirror";

type Props = { value: string; onChange: (value: string) => void };

export function SourceEditor({ value, onChange }: Props) {
  const scheme = useComputedColorScheme("light");
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={scheme}
      minHeight="420px"
      maxHeight="70dvh"
      extensions={[EditorView.lineWrapping]}
      basicSetup={{ foldGutter: false, autocompletion: false }}
      aria-label="Typst kodi"
    />
  );
}
