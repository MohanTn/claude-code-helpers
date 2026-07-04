import test from "node:test";
import assert from "node:assert/strict";
import type { TUI } from "@earendil-works/pi-tui";
import { cdIntoWorktree } from "../actions.js";

// Only the "worktree is gone" guard is exercised here. The success path spawns a real interactive
// shell with inherited stdio (by design — see actions.ts) which isn't something a unit test should
// drive; that path is covered by the manual verification steps in the plan instead.

function fakeTui(): { tui: TUI; calls: string[] } {
  const calls: string[] = [];
  const tui = {
    stop: () => calls.push("stop"),
    start: () => calls.push("start"),
    requestRender: () => calls.push("requestRender"),
  } as unknown as TUI;
  return { tui, calls };
}

test("cdIntoWorktree returns false and never touches the TUI when the worktree is gone", () => {
  const { tui, calls } = fakeTui();
  const result = cdIntoWorktree(tui, "/definitely/not/a/real/worktree/path-xyz");
  assert.equal(result, false);
  assert.deepEqual(calls, []);
});
