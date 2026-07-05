import test from "node:test";
import assert from "node:assert/strict";
import { extractGoal } from "../goal-yagni";

test("extractGoal captures a GOAL: line", () => {
  const text = "Some preamble.\nGOAL: fix the login bug\nMore text after.";
  assert.equal(extractGoal(text), "fix the login bug");
});

test("extractGoal trims surrounding whitespace", () => {
  assert.equal(extractGoal("GOAL:   spaced out goal   "), "spaced out goal");
});

test("extractGoal returns null when no GOAL: line is present", () => {
  assert.equal(extractGoal("Just some assistant prose with no goal statement."), null);
});

test("extractGoal ignores GOAL: mentioned mid-sentence, not at line start", () => {
  assert.equal(extractGoal("Remember to always start with GOAL: as the convention."), null);
});
