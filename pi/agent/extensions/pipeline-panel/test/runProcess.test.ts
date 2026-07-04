import test from "node:test";
import assert from "node:assert/strict";
import { RunProcessManager } from "../runProcess.js";

test("a spawn failure (e.g. pipeline-worker missing from PATH) is captured instead of crashing the process", async () => {
  const originalPath = process.env.PATH;
  process.env.PATH = ""; // guarantees `pipeline-worker` can't be resolved, forcing an ENOENT "error" event

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("manager never reported the spawn failure")), 2000);
      const manager = new RunProcessManager(() => {
        const run = manager.all()[0];
        if (run && !run.running) {
          clearTimeout(timeout);
          try {
            assert.equal(run.exitCode, null);
            assert.ok(run.lines.some((line) => line.includes("failed to start")));
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });
      manager.launch(process.cwd(), ["run"]);
    });
  } finally {
    process.env.PATH = originalPath;
  }
});
