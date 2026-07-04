import { Key, matchesKey, truncateToWidth, type Component, type TUI } from "@earendil-works/pi-tui";
import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { adoptPendingRuns, listRunStates, mergeRuns } from "./runState.js";
import { RunProcessManager } from "./runProcess.js";
import { joinRow, padToVisibleWidth, splitColumns, tailLines } from "./layout.js";
import { cdIntoWorktree, openInBrowser } from "./actions.js";
import type { DashboardRow } from "./types.js";

const REFRESH_INTERVAL_MS = 2000;
const STATUS_MESSAGE_MS = 4000;
const HELP_LINE = "[n]ew  [r]esume  [o]pen link  [c]d worktree  ↑/↓ select  [q]uit";

export interface DashboardNavState {
  selectedIndex: number;
  rowCount: number;
}

export type DashboardNavAction = { type: "up" } | { type: "down" } | { type: "setRowCount"; count: number };

/** Pure keybinding-navigation reducer, kept separate from the Component so it's testable without a real terminal. */
export function reduceDashboardNav(state: DashboardNavState, action: DashboardNavAction): DashboardNavState {
  switch (action.type) {
    case "up":
      return state.rowCount === 0 ? state : { ...state, selectedIndex: (state.selectedIndex - 1 + state.rowCount) % state.rowCount };
    case "down":
      return state.rowCount === 0 ? state : { ...state, selectedIndex: (state.selectedIndex + 1) % state.rowCount };
    case "setRowCount": {
      const rowCount = Math.max(0, action.count);
      const selectedIndex = rowCount === 0 ? 0 : Math.min(state.selectedIndex, rowCount - 1);
      return { rowCount, selectedIndex };
    }
  }
}

/** Full-screen left/right dashboard for launching and watching pipeline-worker runs, shown via ctx.ui.custom(). */
export class PipelineDashboard implements Component {
  private nav: DashboardNavState = { selectedIndex: 0, rowCount: 0 };
  private rows: DashboardRow[] = [];
  private refreshTimer: ReturnType<typeof setInterval>;
  /**
   * ctx.ui.notify() renders into the normal chat chrome, which this full-screen (non-overlay)
   * component replaces entirely — so a notify() call during the dashboard queues silently and
   * only appears once the dashboard closes. Action feedback (stale worktree, no link yet) needs
   * to be visible immediately, so it's rendered as a line in this component instead.
   */
  private statusMessage?: { text: string; expiresAt: number };

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly ctx: ExtensionCommandContext,
    private readonly processes: RunProcessManager,
    private readonly done: () => void,
  ) {
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
  }

  private refresh(): void {
    const disk = listRunStates(this.ctx.cwd);
    adoptPendingRuns(disk, this.processes.all());
    this.rows = mergeRuns(disk, this.processes.all());
    this.nav = reduceDashboardNav(this.nav, { type: "setRowCount", count: this.rows.length });
    this.tui.requestRender();
  }

  private selectedRow(): DashboardRow | undefined {
    return this.rows[this.nav.selectedIndex];
  }

  /** Called by the process manager when a tracked run produces new output, so its log tails live instead of waiting for the next refresh tick. */
  requestRender(): void {
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) || data === "k") return this.setNav(reduceDashboardNav(this.nav, { type: "up" }));
    if (matchesKey(data, Key.down) || data === "j") return this.setNav(reduceDashboardNav(this.nav, { type: "down" }));
    if (matchesKey(data, Key.escape) || data === "q") return this.close();
    if (data === "n") return void this.launchNew();
    if (data === "r") return this.resumeSelected();
    if (data === "o") return this.openSelectedLink();
    if (data === "c") return this.cdIntoSelected();
  }

  private setNav(next: DashboardNavState): void {
    this.nav = next;
    this.tui.requestRender();
  }

  private close(): void {
    clearInterval(this.refreshTimer);
    this.done();
  }

  private async launchNew(): Promise<void> {
    const ticket = await this.ctx.ui.input("Ticket id (optional, Enter to skip):", "");
    const args = ["run", ...(ticket ? ["--ticket", ticket] : [])];
    this.processes.launch(this.ctx.cwd, args);
    this.refresh();
  }

  private resumeSelected(): void {
    const row = this.selectedRow();
    if (!row || row.phase === "starting") return;
    if (row.live?.running) {
      this.showStatus(`${row.branch} is already running.`);
      return;
    }
    this.processes.launch(this.ctx.cwd, ["resume", "--branch", row.branch]);
    this.refresh();
  }

  private openSelectedLink(): void {
    const live = this.selectedRow()?.live;
    const url = live?.mrUrl ?? live?.pipelineUrl;
    if (url) {
      openInBrowser(url);
    } else {
      this.showStatus("No MR/pipeline link yet for this run.");
    }
  }

  private cdIntoSelected(): void {
    const row = this.selectedRow();
    const worktreePath = row?.worktreePath ?? row?.live?.worktreePath;
    if (!worktreePath) return;
    if (!cdIntoWorktree(this.tui, worktreePath)) {
      this.showStatus(`Worktree no longer exists: ${worktreePath}`);
    }
  }

  private showStatus(text: string): void {
    this.statusMessage = { text, expiresAt: Date.now() + STATUS_MESSAGE_MS };
    this.tui.requestRender();
  }

  /** Returns the still-live status line, if any, clearing it once it has expired. */
  private currentStatusLine(): string | undefined {
    if (!this.statusMessage) return undefined;
    if (Date.now() > this.statusMessage.expiresAt) {
      this.statusMessage = undefined;
      return undefined;
    }
    return this.statusMessage.text;
  }

  invalidate(): void {
    // Rows are recomputed on every refresh tick and input event; nothing is cached across renders.
  }

  render(width: number): string[] {
    const { leftWidth, rightWidth } = splitColumns(width);
    const statusLine = this.currentStatusLine();
    const chromeHeight = statusLine ? 5 : 4; // header + 2 separators + help (+ status line)
    const bodyHeight = Math.max(1, (process.stdout.rows || 24) - chromeHeight);

    const leftRows = this.renderLeftRows(leftWidth);
    const rightLines = this.renderRightPane(rightWidth, bodyHeight);

    const lines: string[] = [];
    lines.push(joinRow(this.theme.fg("dim", "RUNS"), leftWidth, this.rightHeader(), rightWidth));
    lines.push("─".repeat(leftWidth) + "┼" + "─".repeat(rightWidth));
    for (let i = 0; i < bodyHeight; i++) {
      lines.push(joinRow(leftRows[i] ?? "", leftWidth, rightLines[i] ?? "", rightWidth));
    }
    lines.push("─".repeat(leftWidth) + "┴" + "─".repeat(rightWidth));
    if (statusLine) lines.push(padToVisibleWidth(this.theme.fg("warning", statusLine), width));
    lines.push(padToVisibleWidth(this.theme.fg("dim", HELP_LINE), width));
    return lines;
  }

  private rightHeader(): string {
    const row = this.selectedRow();
    return row ? `${row.branch}  [${row.live?.running ? "running" : row.phase}]` : "no runs yet — press n to launch one";
  }

  private renderLeftRows(width: number): string[] {
    if (this.rows.length === 0) return [padToVisibleWidth("(no runs yet)", width)];
    return this.rows.map((row, i) => {
      const marker = i === this.nav.selectedIndex ? "> " : "  ";
      const phase = row.live?.running ? "running" : row.phase;
      return truncateToWidth(`${marker}${row.branch}  ${phase}`, width);
    });
  }

  private renderRightPane(width: number, height: number): string[] {
    const row = this.selectedRow();
    if (!row) return [];
    const live = row.live;
    if (!live) return [`not running — press r to resume ${row.branch}`];

    const links: string[] = [];
    if (live.mrUrl) links.push(`MR: ${live.mrUrl}`);
    if (live.pipelineUrl) links.push(`Pipeline: ${live.pipelineUrl}`);
    const tail = tailLines(live.lines, height - links.length);
    return [...links, ...tail].map((line) => truncateToWidth(line, width));
  }
}
