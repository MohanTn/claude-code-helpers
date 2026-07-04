import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adoptPendingRuns, listRunStates, mergeRuns } from "../runState.js";
import type { RunState, TrackedRun } from "../types.js";

function makeRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), "pipeline-panel-test-"));
  mkdirSync(join(repoRoot, ".pipeline-worker", "state"), { recursive: true });
  return repoRoot;
}

function writeState(repoRoot: string, filename: string, state: RunState): void {
  writeFileSync(join(repoRoot, ".pipeline-worker", "state", filename), JSON.stringify(state));
}

test("listRunStates returns [] when no state dir exists", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pipeline-panel-test-"));
  assert.deepEqual(listRunStates(repoRoot), []);
  rmSync(repoRoot, { recursive: true, force: true });
});

test("listRunStates sorts by updatedAt, most recent first", () => {
  const repoRoot = makeRepo();
  writeState(repoRoot, "a.json", { branch: "a", targetBranch: "main", worktreePath: "/tmp/a", attempt: 0, phase: "watch", updatedAt: "2026-01-01T00:00:00.000Z" });
  writeState(repoRoot, "b.json", { branch: "b", targetBranch: "main", worktreePath: "/tmp/b", attempt: 0, phase: "done", updatedAt: "2026-01-03T00:00:00.000Z" });
  writeState(repoRoot, "c.json", { branch: "c", targetBranch: "main", worktreePath: "/tmp/c", attempt: 0, phase: "mr", updatedAt: "2026-01-02T00:00:00.000Z" });

  const states = listRunStates(repoRoot);
  assert.deepEqual(states.map((s) => s.branch), ["b", "c", "a"]);
  rmSync(repoRoot, { recursive: true, force: true });
});

test("listRunStates skips corrupt or partial state files instead of throwing", () => {
  const repoRoot = makeRepo();
  writeFileSync(join(repoRoot, ".pipeline-worker", "state", "broken.json"), "{not json");
  writeFileSync(join(repoRoot, ".pipeline-worker", "state", "empty.json"), "{}");
  writeState(repoRoot, "ok.json", { branch: "ok", targetBranch: "main", worktreePath: "/tmp/ok", attempt: 0, phase: "watch", updatedAt: "2026-01-01T00:00:00.000Z" });

  const states = listRunStates(repoRoot);
  assert.deepEqual(states.map((s) => s.branch), ["ok"]);
  rmSync(repoRoot, { recursive: true, force: true });
});

function trackedRun(overrides: Partial<TrackedRun>): TrackedRun {
  return { id: "id", launchedAt: new Date(0).toISOString(), lines: [], running: true, exitCode: null, ...overrides };
}

test("mergeRuns pairs disk states with live processes by branch, and shows unclaimed processes as pending rows first", () => {
  const disk: RunState[] = [
    { branch: "add-login", targetBranch: "main", worktreePath: "/tmp/add-login", attempt: 0, phase: "watch", updatedAt: "2026-01-02T00:00:00.000Z" },
    { branch: "old-run", targetBranch: "main", worktreePath: "/tmp/old-run", attempt: 0, phase: "done", updatedAt: "2026-01-01T00:00:00.000Z" },
  ];
  const live = [trackedRun({ id: "live-1", branch: "add-login" }), trackedRun({ id: "pending-1" })];

  const rows = mergeRuns(disk, live);

  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.key, "pending-1");
  assert.equal(rows[0]?.phase, "starting");
  assert.equal(rows[1]?.branch, "add-login");
  assert.equal(rows[1]?.live?.id, "live-1");
  assert.equal(rows[2]?.branch, "old-run");
  assert.equal(rows[2]?.live, undefined);
});

test("adoptPendingRuns claims the earliest disk state created after a pending run launched", () => {
  const launchedAt = "2026-01-01T00:00:10.000Z";
  const pending = trackedRun({ id: "pending-1", launchedAt });
  const alreadyClaimed = trackedRun({ id: "live-1", branch: "other-run" });

  const disk: RunState[] = [
    { branch: "other-run", targetBranch: "main", worktreePath: "/tmp/other-run", attempt: 0, phase: "watch", startedAt: "2026-01-01T00:00:05.000Z" },
    { branch: "tmp-abcd", targetBranch: "main", worktreePath: "/tmp/tmp-abcd", attempt: 0, phase: "diff", startedAt: "2026-01-01T00:00:11.000Z" },
  ];

  adoptPendingRuns(disk, [pending, alreadyClaimed]);

  assert.equal(pending.branch, "tmp-abcd");
  assert.equal(pending.worktreePath, "/tmp/tmp-abcd");
});

test("adoptPendingRuns leaves a pending run unclaimed when no disk state is new enough yet", () => {
  const pending = trackedRun({ id: "pending-1", launchedAt: "2026-01-01T00:00:10.000Z" });
  const disk: RunState[] = [
    { branch: "older", targetBranch: "main", worktreePath: "/tmp/older", attempt: 0, phase: "diff", startedAt: "2026-01-01T00:00:00.000Z" },
  ];

  adoptPendingRuns(disk, [pending]);

  assert.equal(pending.branch, undefined);
});
