/**
 * pi-hooks: Port of Claude Code hooks into pi extension lifecycle.
 *
 * Imports and registers all hook modules:
 *   - session-lifecycle   : project digest, state cleanup, compaction snapshot
 *   - goal-yagni          : GOAL capture, YAGNI injection, self-check verification
 *   - tts-ding            : completion sound
 *   - bash-guard          : bash cmd dedup, failure memory, npm script check, output trimming
 *   - edit-guard          : edit/write no-op guard, architecture hints, tsc/CS build gates
 *   - read-cache          : duplicate-read cache, read-before-grep nudge, backstop truncation
 *   - loop-breaker        : >3 consecutive identical tool call detection
 *   - output-trimmers     : grep/glob/find/ls output trimming, explore subagent nudge
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupSessionLifecycle } from "./session-lifecycle";
import { setupGoalYagni } from "./goal-yagni";
import { setupDing } from "./tts-ding";
import { setupBashGuard } from "./bash-guard";
import { setupEditGuard } from "./edit-guard";
import { setupReadCache } from "./read-cache";
import { setupLoopBreaker } from "./loop-breaker";
import { setupOutputTrimmers } from "./output-trimmers";

export default function (pi: ExtensionAPI): void {
  // Order matters: session lifecycle must run first to establish state directories
  setupSessionLifecycle(pi);
  setupGoalYagni(pi);
  setupDing(pi);

  // Guards and verifiers
  setupBashGuard(pi);
  setupEditGuard(pi);
  setupReadCache(pi);
  setupLoopBreaker(pi);
  setupOutputTrimmers(pi);
}
