/** Mirrors pipeline-worker's own RunState shape (src/types.ts in the pipeline-worker repo). */

export type RunPhase = "diff" | "intent" | "checks" | "mr" | "watch" | "done" | "escalated";

export interface RunHistoryEntry {
  at: string;
  phase: RunPhase;
  level: "info" | "error";
  message: string;
}

export interface RunState {
  branch: string;
  targetBranch: string;
  worktreePath: string;
  mrIid?: number;
  pipelineId?: number;
  attempt: number;
  phase: RunPhase;
  startedAt?: string;
  updatedAt?: string;
  history?: RunHistoryEntry[];
}

/** A live pipeline-worker child process this extension spawned, whether or not it has been correlated to an on-disk RunState yet. */
export interface TrackedRun {
  id: string;
  launchedAt: string;
  branch?: string;
  worktreePath?: string;
  lines: string[];
  mrUrl?: string;
  pipelineUrl?: string;
  running: boolean;
  exitCode: number | null;
}

/** One row of the dashboard's left-hand list: an on-disk run, optionally paired with its live process. */
export interface DashboardRow {
  key: string;
  branch: string;
  phase: RunPhase | "starting";
  worktreePath?: string;
  updatedAt?: string;
  live?: TrackedRun;
}
