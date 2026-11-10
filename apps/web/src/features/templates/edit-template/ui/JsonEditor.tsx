import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror from "@uiw/react-codemirror";
import { EditorFrame } from "./EditorFrame";
import { editorTheme } from "./editor-theme";
import { readOnlyGuard } from "./read-only-guard";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  readOnly?: boolean;
  /** Called when the user tries to edit while `readOnly`. */
  onBlockedEdit?: () => void;
};

/** CodeMirror JSON editor (schema and sample data); fills its parent's remaining height. */
export function JsonEditor({ value, onChange, label, readOnly, onBlockedEdit }: Props) {
  const scheme = useComputedColorScheme("light");
  return (
    <EditorFrame>
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        theme={scheme}
        height="100%"
        // The wrapper must be bounded too, otherwise the editor grows with its content
        // instead of scrolling internally.
        style={{ height: "100%" }}
        extensions={[
          json(),
          EditorView.lineWrapping,
          editorTheme,
          ...(readOnly && onBlockedEdit ? [readOnlyGuard(onBlockedEdit)] : []),
        ]}
        basicSetup={{ foldGutter: true, autocompletion: false }}
        aria-label={label}
      />
    </EditorFrame>
  );
}
