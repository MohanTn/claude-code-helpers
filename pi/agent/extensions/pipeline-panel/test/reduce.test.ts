import test from "node:test";
import assert from "node:assert/strict";
import { reduceDashboardNav, type DashboardNavState } from "../dashboard.js";

const state = (selectedIndex: number, rowCount: number): DashboardNavState => ({ selectedIndex, rowCount });

test("down moves the selection forward", () => {
  const next = reduceDashboardNav(state(0, 3), { type: "down" });
  assert.equal(next.selectedIndex, 1);
});

test("down wraps from the last row back to the first", () => {
  const next = reduceDashboardNav(state(2, 3), { type: "down" });
  assert.equal(next.selectedIndex, 0);
});

test("up moves the selection backward", () => {
  const next = reduceDashboardNav(state(2, 3), { type: "up" });
  assert.equal(next.selectedIndex, 1);
});

test("up wraps from the first row back to the last", () => {
  const next = reduceDashboardNav(state(0, 3), { type: "up" });
  assert.equal(next.selectedIndex, 2);
});

test("up/down are no-ops when there are no rows", () => {
  assert.deepEqual(reduceDashboardNav(state(0, 0), { type: "up" }), state(0, 0));
  assert.deepEqual(reduceDashboardNav(state(0, 0), { type: "down" }), state(0, 0));
});

test("setRowCount clamps the current selection when the list shrinks", () => {
  const next = reduceDashboardNav(state(4, 5), { type: "setRowCount", count: 2 });
  assert.deepEqual(next, state(1, 2));
});

test("setRowCount resets selection to 0 when the list becomes empty", () => {
  const next = reduceDashboardNav(state(4, 5), { type: "setRowCount", count: 0 });
  assert.deepEqual(next, state(0, 0));
});

test("setRowCount leaves selection untouched when it still fits", () => {
  const next = reduceDashboardNav(state(1, 3), { type: "setRowCount", count: 5 });
  assert.deepEqual(next, state(1, 5));
});
