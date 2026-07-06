import test from "node:test";
import assert from "node:assert/strict";
import { nextLoopCount } from "../loop-breaker";

test("nextLoopCount resets to 1 on the first call (no prior signature)", () => {
  assert.equal(nextLoopCount("", "sig-a", 0), 1);
});

test("nextLoopCount increments on consecutive identical signatures", () => {
  let count = nextLoopCount("", "sig-a", 0);
  count = nextLoopCount("sig-a", "sig-a", count);
  count = nextLoopCount("sig-a", "sig-a", count);
  assert.equal(count, 3);
});

test("nextLoopCount resets to 1 when the signature changes", () => {
  let count = nextLoopCount("", "sig-a", 0);
  count = nextLoopCount("sig-a", "sig-a", count);
  count = nextLoopCount("sig-a", "sig-b", count);
  assert.equal(count, 1);
});
