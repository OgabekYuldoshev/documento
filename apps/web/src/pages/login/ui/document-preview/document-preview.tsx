import classes from "./document-preview.module.scss";

const LINE_WIDTHS = ["100%", "96%", "88%", "92%", "54%"];

export function DocumentPreview() {
  return (
    <div className={classes.root} aria-hidden>
      <div className={classes.layer} data-layer="back" />
      <div className={classes.layer} data-layer="middle" />
      <div className={classes.page}>
        <div className={classes.header}>
          <div className={classes.logo} />
          <div className={classes.line} style={{ width: "22%" }} data-subtle />
        </div>
        <div className={classes.title} />
        <div className={classes.lines}>
          {LINE_WIDTHS.map((width) => (
            <div key={width} className={classes.line} style={{ width }} />
          ))}
        </div>
        <div className={classes.blocks}>
          <div className={classes.block} />
          <div className={classes.block} />
          <div className={classes.block} />
        </div>
      </div>
    </div>
  );
}
