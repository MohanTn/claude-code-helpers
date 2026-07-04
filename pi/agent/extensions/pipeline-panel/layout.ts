import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const SEPARATOR = "│";
const MIN_LEFT_WIDTH = 18;
const MAX_LEFT_WIDTH = 30;
const LEFT_FRACTION = 0.3;

/** Splits a terminal width into left/right pane widths (plus a 1-column separator), so left + 1 + right never exceeds totalWidth. */
export function splitColumns(totalWidth: number): { leftWidth: number; rightWidth: number } {
  const available = Math.max(0, totalWidth - SEPARATOR.length);
  const desired = Math.round(available * LEFT_FRACTION);
  const clamped = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, desired));
  const leftWidth = Math.min(clamped, available);
  const rightWidth = available - leftWidth;
  return { leftWidth, rightWidth };
}

/** Pads or truncates a string to exactly `width` visible columns, ignoring ANSI escape codes when measuring. */
export function padToVisibleWidth(text: string, width: number): string {
  if (width <= 0) return "";
  const truncated = truncateToWidth(text, width);
  const pad = Math.max(0, width - visibleWidth(truncated));
  return truncated + " ".repeat(pad);
}

/** Joins one left-pane line and one right-pane line into a single row exactly `leftWidth + 1 + rightWidth` columns wide. */
export function joinRow(left: string, leftWidth: number, right: string, rightWidth: number): string {
  return padToVisibleWidth(left, leftWidth) + SEPARATOR + padToVisibleWidth(right, rightWidth);
}

/**
 * Returns the last `maxCount` lines, or none when `maxCount` is 0.
 *
 * `lines.slice(-0)` returns the *whole* array (since `-0 === 0`), not an empty one, so a plain
 * `lines.slice(-maxCount)` silently breaks the moment there's no room left to show anything.
 */
export function tailLines(lines: string[], maxCount: number): string[] {
  if (maxCount <= 0) return [];
  return lines.slice(-maxCount);
}
