import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DashboardRow, RunState, TrackedRun } from "./types.js";

function stateDir(repoRoot: string): string {
  return join(repoRoot, ".pipeline-worker", "state");
}

/** Reads every persisted pipeline-worker run for this repo, most recently updated first. A corrupt/partial state file is skipped, matching pipeline-worker's own listRunStates(). */
export function listRunStates(repoRoot: string): RunState[] {
  const dir = stateDir(repoRoot);
  if (!existsSync(dir)) return [];

  const states: RunState[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    try {
      const state = JSON.parse(readFileSync(join(dir, entry), "utf-8")) as RunState;
      if (state.branch && state.phase) states.push(state);
    } catch {
      continue;
    }
  }

  return states.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

/**
 * Joins on-disk run states with this extension's live child processes into the dashboard's row list.
 *
 * A newly launched run has no on-disk state yet (or is still under its throwaway temp-branch name),
 * so any tracked process not yet adopted to a branch is shown as a synthetic "starting" row pinned to
 * the top, ahead of the on-disk rows (sorted by updatedAt, most recent first).
 */
export function mergeRuns(diskStates: RunState[], trackedRuns: TrackedRun[]): DashboardRow[] {
  const liveByBranch = new Map<string, TrackedRun>();
  for (const run of trackedRuns) {
    if (run.branch) liveByBranch.set(run.branch, run);
  }

  const diskRows: DashboardRow[] = diskStates.map((state) => ({
    key: state.branch,
    branch: state.branch,
    phase: state.phase,
    worktreePath: state.worktreePath,
    updatedAt: state.updatedAt,
    live: liveByBranch.get(state.branch),
  }));

  const pendingRows: DashboardRow[] = trackedRuns
    .filter((run) => !run.branch)
    .map((run) => ({
      key: run.id,
      branch: "(starting…)",
      phase: "starting",
      live: run,
    }));

  return [...pendingRows, ...diskRows];
}

/**
 * Adopts freshly launched (still-unbranched) tracked processes to the on-disk RunState that appeared
 * after they were spawned. pipeline-worker writes its first state file (under a throwaway temp branch
 * name) within moments of `run` starting, well before intent capture picks the real feature branch, so
 * correlating by "first state file created after this process launched" is reliable and doesn't require
 * parsing branch names out of stdout.
 */
export function adoptPendingRuns(diskStates: RunState[], trackedRuns: TrackedRun[]): void {
  const claimed = new Set(trackedRuns.filter((run) => run.branch).map((run) => run.branch));
  const pending = trackedRuns.filter((run) => !run.branch).sort((a, b) => a.launchedAt.localeCompare(b.launchedAt));
  if (pending.length === 0) return;

  const candidates = diskStates
    .filter((state) => !claimed.has(state.branch))
    .sort((a, b) => (a.startedAt ?? a.updatedAt ?? "").localeCompare(b.startedAt ?? b.updatedAt ?? ""));

  for (const run of pending) {
    const match = candidates.find((state) => (state.startedAt ?? state.updatedAt ?? "") >= run.launchedAt);
    if (!match) continue;
    run.branch = match.branch;
    run.worktreePath = match.worktreePath;
    claimed.add(match.branch);
    candidates.splice(candidates.indexOf(match), 1);
  }
}
