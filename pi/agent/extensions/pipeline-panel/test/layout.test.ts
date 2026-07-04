import test from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { joinRow, padToVisibleWidth, splitColumns, tailLines } from "../layout.js";

test("splitColumns keeps left+separator+right within totalWidth across a range of terminal sizes", () => {
  for (const totalWidth of [0, 1, 10, 18, 39, 40, 80, 120, 200]) {
    const { leftWidth, rightWidth } = splitColumns(totalWidth);
    assert.ok(leftWidth >= 0, `leftWidth should be non-negative at width ${totalWidth}`);
    assert.ok(rightWidth >= 0, `rightWidth should be non-negative at width ${totalWidth}`);
    assert.ok(leftWidth + 1 + rightWidth <= Math.max(totalWidth, 1), `columns should fit within width ${totalWidth}`);
  }
});

test("splitColumns clamps the left pane between its min and max on wide terminals", () => {
  const { leftWidth } = splitColumns(200);
  assert.equal(leftWidth, 30);
});

test("splitColumns shrinks the left pane on narrow terminals rather than overflowing", () => {
  const { leftWidth, rightWidth } = splitColumns(10);
  assert.equal(leftWidth + 1 + rightWidth, 10);
});

test("padToVisibleWidth pads a plain string out to the exact width", () => {
  const padded = padToVisibleWidth("hi", 5);
  assert.equal(padded, "hi   ");
  assert.equal(padded.length, 5);
});

test("padToVisibleWidth truncates a string longer than the width", () => {
  // truncateToWidth's ellipsis/reset-code handling means raw .length isn't meaningful here;
  // visibleWidth() is what the TUI actually measures against the terminal column budget.
  const padded = padToVisibleWidth("hello world", 5);
  assert.equal(visibleWidth(padded), 5);
});

test("padToVisibleWidth measures ANSI-styled text by its visible width, not raw character count", () => {
  const styled = "\x1b[31mred\x1b[0m"; // visibly 3 columns wide despite being a longer string
  const padded = padToVisibleWidth(styled, 6);
  // Can't assert exact byte length (ANSI codes remain in the output), but the visible
  // content plus 3 padding spaces should follow the reset code.
  assert.ok(padded.endsWith("   "), "should append 3 padding spaces for a 3-column-wide styled string in a 6-wide cell");
});

test("joinRow produces a single row exactly leftWidth + 1 + rightWidth columns wide", () => {
  const row = joinRow("left text", 12, "right text", 10);
  assert.equal(row.length, 12 + 1 + 10);
  assert.equal(row[12], "│");
});

test("joinRow pads a short right-pane line out to the full right width", () => {
  const row = joinRow("left", 12, "hi", 10);
  assert.equal(row.length, 12 + 1 + 10);
});

test("tailLines returns no empty when maxCount is 0, unlike a naive slice(-0)", () => {
  // Array.prototype.slice(-0) returns the *whole* array, since -0 === 0 — this regression-tests
  // the exact gotcha that motivated pulling tailLines out as its own helper.
  assert.deepEqual(tailLines(["a", "b", "c"], 0), []);
});

test("tailLines returns the last maxCount entries when there's room", () => {
  assert.deepEqual(tailLines(["a", "b", "c", "d"], 2), ["c", "d"]);
});

test("tailLines returns the whole array when maxCount exceeds its length", () => {
  assert.deepEqual(tailLines(["a", "b"], 5), ["a", "b"]);
});
