import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import type { TrackedRun } from "./types.js";

/** Caps each run's log buffer, mirroring pipeline-worker's own MAX_HISTORY_ENTRIES cap on state.history. */
const MAX_LOG_LINES = 200;

const MR_URL_RE = /https?:\/\/\S+\/(?:merge_requests|pull)\/\d+/;
const PIPELINE_URL_RE = /https?:\/\/\S+\/(?:pipelines|actions\/runs)\/\d+/;

/** Pulls an MR/PR or pipeline/CI-run link out of one line of pipeline-worker's stdout, if present. */
export function extractLinks(line: string): { mrUrl?: string; pipelineUrl?: string } {
  const mr = line.match(MR_URL_RE)?.[0];
  const pipeline = line.match(PIPELINE_URL_RE)?.[0];
  return { mrUrl: mr, pipelineUrl: pipeline };
}

/** Spawns and tracks `pipeline-worker` child processes for the dashboard, buffering their combined stdout/stderr per run. */
export class RunProcessManager {
  private runs = new Map<string, TrackedRun>();
  private children = new Map<string, ChildProcess>();
  private readonly onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  all(): TrackedRun[] {
    return [...this.runs.values()];
  }

  /** Spawns `pipeline-worker <args>` in cwd and starts tracking it. Returns the new run's internal id. */
  launch(cwd: string, args: string[]): string {
    const id = randomUUID();
    const child = spawn("pipeline-worker", args, { cwd, env: process.env });

    const run: TrackedRun = {
      id,
      launchedAt: new Date().toISOString(),
      lines: [],
      running: true,
      exitCode: null,
    };
    this.runs.set(id, run);
    this.children.set(id, child);

    let carry = "";
    const onChunk = (chunk: Buffer) => {
      carry += chunk.toString("utf-8");
      const parts = carry.split("\n");
      carry = parts.pop() ?? "";
      for (const line of parts) this.appendLine(run, line);
      if (parts.length > 0) this.onUpdate();
    };

    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("close", (code) => {
      if (carry) this.appendLine(run, carry);
      run.running = false;
      run.exitCode = code;
      this.onUpdate();
    });
    // A ChildProcess's "error" event (e.g. ENOENT when `pipeline-worker` isn't on PATH) throws if
    // left unhandled, which would take down the whole pi process — so this must always be wired up,
    // not just left to the "close" handler above (spawn failures never fire "close").
    child.on("error", (error) => {
      this.appendLine(run, `pipeline-worker failed to start: ${error.message}`);
      run.running = false;
      run.exitCode = null;
      this.onUpdate();
    });

    return id;
  }

  private appendLine(run: TrackedRun, line: string): void {
    run.lines.push(line);
    if (run.lines.length > MAX_LOG_LINES) run.lines.splice(0, run.lines.length - MAX_LOG_LINES);
    const { mrUrl, pipelineUrl } = extractLinks(line);
    if (mrUrl) run.mrUrl = mrUrl;
    if (pipelineUrl) run.pipelineUrl = pipelineUrl;
  }

  /** Best-effort SIGTERM for every process this manager spawned, run on session_shutdown so pi exiting never leaves an orphaned pipeline-worker behind. */
  killAll(): void {
    for (const [id, run] of this.runs) {
      if (!run.running) continue;
      this.children.get(id)?.kill("SIGTERM");
    }
  }
}
