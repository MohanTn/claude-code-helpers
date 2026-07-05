/**
 * pi-hooks: Port of Claude Code hooks into pi extension lifecycle.
 *
 * Imports and registers all hook modules:
 *   - session-lifecycle   : project digest, state cleanup
 *   - goal-yagni          : digest injection, GOAL capture, YAGNI injection, self-check verification
 *   - edit-guard          : edit/write no-op guard, import/tsc/CS build gates, sonar-lite
 *   - loop-breaker        : >3 consecutive identical tool call detection
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupSessionLifecycle } from "./session-lifecycle";
import { setupGoalYagni } from "./goal-yagni";
import { setupEditGuard } from "./edit-guard";
import { setupLoopBreaker } from "./loop-breaker";

export default function (pi: ExtensionAPI): void {
  // Order matters: session lifecycle must run first to establish state directories
  setupSessionLifecycle(pi);
  setupGoalYagni(pi);

  // Guards and verifiers
  setupEditGuard(pi);
  setupLoopBreaker(pi);
}
