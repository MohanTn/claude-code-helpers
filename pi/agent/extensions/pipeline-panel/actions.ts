import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import type { TUI } from "@earendil-works/pi-tui";

/** Opens a URL with the platform's default browser, falling back to $BROWSER on Linux when set. */
export function openInBrowser(url: string): void {
  const os = platform();
  if (os === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
  } else if (os === "win32") {
    spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  } else {
    spawnSync(process.env.BROWSER || "xdg-open", [url], { stdio: "ignore" });
  }
}

/**
 * Suspends the dashboard's TUI and drops the user into a real, interactive shell whose cwd is the
 * run's worktree. Typing `exit` returns control to the dashboard. Same tui.stop()/spawnSync/tui.start()
 * handoff pi's own examples/extensions/interactive-shell.ts uses for `!vim`, `!htop`, etc.
 *
 * Returns false without touching the TUI when the worktree is gone (pipeline-worker's own
 * cleanupOnSuccess/cleanupEarly, or just an OS /tmp reaper, can remove it well before the run drops
 * out of `pipeline-worker sessions`), so the caller can tell the user why nothing happened.
 */
export function cdIntoWorktree(tui: TUI, worktreePath: string): boolean {
  if (!existsSync(worktreePath)) return false;

  const shell = process.env.SHELL || "/bin/sh";
  tui.stop();
  process.stdout.write("\x1b[2J\x1b[H");
  spawnSync(shell, [], { stdio: "inherit", cwd: worktreePath, env: process.env });
  tui.start();
  tui.requestRender(true);
  return true;
}
