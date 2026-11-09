export type Diagnostic = {
  severity: "error" | "warning";
  file?: string;
  line?: number;
  column?: number;
  message: string;
};

const WITH_POSITION = /^(.+?):(\d+):(\d+): (error|warning): (.*)$/;
const WITHOUT_POSITION = /^(error|warning): (.*)$/;
const MAX_DIAGNOSTICS = 50;
const MAX_MESSAGE = 500;

/** Parses `--diagnostic-format short` output. Never throws; unknown lines are ignored. */
export function parseDiagnostics(stderr: string, workDir?: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const raw of stderr.split("\n")) {
    if (out.length >= MAX_DIAGNOSTICS) break;
    const line = workDir ? raw.split(workDir).join("") : raw;
    const withPos = WITH_POSITION.exec(line);
    if (withPos) {
      out.push({
        severity: withPos[4] as Diagnostic["severity"],
        file: (withPos[1] ?? "").replace(/^\/+/, ""),
        line: Number(withPos[2]),
        column: Number(withPos[3]),
        message: (withPos[5] ?? "").slice(0, MAX_MESSAGE),
      });
      continue;
    }
    const bare = WITHOUT_POSITION.exec(line);
    if (bare) {
      out.push({
        severity: bare[1] as Diagnostic["severity"],
        message: (bare[2] ?? "").slice(0, MAX_MESSAGE),
      });
    }
  }
  return out;
}
