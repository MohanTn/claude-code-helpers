/**
 * pipeline-panel: a pi extension that opens a full-screen dashboard (`/pipeline`) for launching and
 * watching `pipeline-worker` runs (worktree -> agent fix loop -> MR/PR -> CI watch) without leaving pi.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { RunProcessManager } from "./runProcess.js";
import { PipelineDashboard } from "./dashboard.js";

export default function (pi: ExtensionAPI): void {
  // Module-scoped so runs keep streaming across closing/reopening the dashboard within the same pi
  // session; only session_shutdown (pi exiting) tears them down.
  const renderHook = { current: () => {} };
  const processes = new RunProcessManager(() => renderHook.current());

  pi.registerCommand("pipeline", {
    description: "Open the pipeline-worker dashboard: launch and watch runs, jump into a worktree, open MR/CI links",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("The pipeline dashboard requires an interactive terminal.", "warning");
        return;
      }

      await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
        const dashboard = new PipelineDashboard(tui, theme, ctx, processes, () => done());
        renderHook.current = () => dashboard.requestRender();
        return dashboard;
      });

      renderHook.current = () => {};
    },
  });

  pi.on("session_shutdown", async () => {
    processes.killAll();
  });
}
