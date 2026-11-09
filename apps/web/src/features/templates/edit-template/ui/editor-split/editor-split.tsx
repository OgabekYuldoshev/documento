import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import classes from "./editor-split.module.scss";

const MIN = 0.3;
const MAX = 0.7;
const KEY_STEP = 0.02;
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n));

type Props = { left: ReactNode; right: ReactNode };

/** Two resizable panes side by side on wide screens, stacked below 75em. */
export function EditorSplit({ left, right }: Props) {
  const wide = useMediaQuery("(min-width: 75em)", true);
  const [stored, setStored] = useLocalStorage({ key: "documento-editor-split", defaultValue: 0.5 });
  const [drag, setDrag] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const ratio = clamp(drag ?? stored);

  if (!wide) {
    return (
      <div className={`${classes.root} ${classes.stacked}`}>
        <div className={classes.pane} style={{ height: "70dvh" }}>
          {left}
        </div>
        <div className={classes.pane} style={{ height: "80dvh" }}>
          {right}
        </div>
      </div>
    );
  }

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const rect = root.current?.getBoundingClientRect();
    if (drag === null || !rect) return;
    setDrag(clamp((e.clientX - rect.left) / rect.width));
  };
  const stop = () => {
    if (drag !== null) setStored(drag);
    setDrag(null);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") setStored(clamp(ratio - KEY_STEP));
    else if (e.key === "ArrowRight") setStored(clamp(ratio + KEY_STEP));
    else if (e.key === "Home") setStored(0.5);
  };

  return (
    <div
      ref={root}
      className={classes.root}
      style={{ gridTemplateColumns: `minmax(0, ${ratio}fr) 14px minmax(0, ${1 - ratio}fr)` }}
    >
      <div className={classes.pane}>{left}</div>
      {/* biome-ignore lint/a11y/useSemanticElements: a separator that is focusable and adjustable */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Panellar kengligi"
        aria-valuemin={MIN * 100}
        aria-valuemax={MAX * 100}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        className={classes.divider}
        data-dragging={drag !== null ? "" : undefined}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(ratio);
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onDoubleClick={() => setStored(0.5)}
        onKeyDown={onKey}
      />
      <div className={classes.pane}>{right}</div>
    </div>
  );
}
