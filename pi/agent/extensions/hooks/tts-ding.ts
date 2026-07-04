import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Port of stop-ding.sh: play a completion sound.
 * Uses pw-play (PipeWire) if available; otherwise silently skips.
 */

const DING_SOUND = "/usr/share/sounds/freedesktop/stereo/complete.oga";

function playDing(): void {
  if (!existsSync(DING_SOUND)) return;

  const proc = spawn("pw-play", [DING_SOUND], {
    stdio: "ignore",
    detached: true,
  });
  proc.unref();
}

export function setupDing(pi: ExtensionAPI): void {
  pi.on("agent_end", async () => {
    playDing();
  });
}
