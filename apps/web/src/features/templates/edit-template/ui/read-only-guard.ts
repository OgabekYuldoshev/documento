import { EditorView } from "@codemirror/view";

const EDIT_KEYS = new Set(["Backspace", "Delete", "Enter", "Tab"]);

/** Calls `onBlocked` when the user tries to type, paste, cut or drop into a read-only editor. */
export const readOnlyGuard = (onBlocked: () => void) =>
  EditorView.domEventHandlers({
    keydown: (event) => {
      const typing = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (typing || EDIT_KEYS.has(event.key)) onBlocked();
      return false;
    },
    paste: () => {
      onBlocked();
      return false;
    },
    cut: () => {
      onBlocked();
      return false;
    },
    drop: () => {
      onBlocked();
      return false;
    },
  });
