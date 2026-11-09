import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror from "@uiw/react-codemirror";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  minHeight?: string;
};

/** CodeMirror JSON editor (schema and sample data). */
export function JsonEditor({ value, onChange, label, minHeight = "420px" }: Props) {
  const scheme = useComputedColorScheme("light");
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={scheme}
      minHeight={minHeight}
      maxHeight="70dvh"
      extensions={[json(), EditorView.lineWrapping]}
      basicSetup={{ foldGutter: true, autocompletion: false }}
      aria-label={label}
    />
  );
}
