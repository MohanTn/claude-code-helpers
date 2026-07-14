#!/usr/bin/env python3
"""GitHub Copilot CLI status line — month-to-date AI credits + context + folder.

Renders one compact line at the bottom of the Copilot CLI, mirroring the Claude
Code status line (`claude/statusline-usage.py`):

    gpt-5.4 │ ctx ███░░░░░ 48k/128k │ mo 34.2 cr │ dir mohan-dotfiles

Data sources (all read-only):
  * model  -> stdin JSON  (model.display_name)                        [from CLI]
  * ctx    -> stdin JSON  (context_window.*)                          [from CLI]
  * mo     -> Σ data.copilotUsage.totalNanoAiu over every
              ~/.copilot/session-state/*/events.jsonl line of type
              "assistant.usage" whose timestamp falls in the current calendar
              month, divided by 1e9 (nano-AI-units -> AI credits). [local, summed]
  * dir    -> stdin JSON  (workspace.current_dir / cwd)               [from CLI]

Copilot does NOT pass the monthly credit total to a custom status line command
(its stdin `ai_used` is session-scoped only), so this script aggregates the
persisted per-call usage events itself. Scanning every session's event log on
each render would be wasteful, so the monthly sum is cached for USAGE_TTL seconds.

Contract: this script must ALWAYS exit 0 and print exactly one line; any failure
degrades gracefully rather than breaking the CLI footer.

Usage: `statusline-usage.py`   -> render a status line (reads stdin JSON)
"""
from __future__ import annotations

import glob
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# ----------------------------------------------------------------------------
# Configuration — override via environment variables.
# ----------------------------------------------------------------------------
COPILOT_DIR = Path(os.environ.get("COPILOT_CONFIG_DIR", Path.home() / ".copilot"))
SESSION_STATE = COPILOT_DIR / "session-state"
USAGE_CACHE = COPILOT_DIR / ".statusline-usage-cache.json"

CONTEXT_WINDOW = int(os.environ.get("COPILOT_CONTEXT_WINDOW", 128_000))
USAGE_TTL = int(os.environ.get("COPILOT_USAGE_TTL", 10))  # seconds before recompute

NANO_PER_CREDIT = 1_000_000_000  # totalNanoAiu is nano-AI-units; credits = n / 1e9
BAR_WIDTH = 8

# Truecolor palette (matches the Claude status line: coral accent, muted separators)
C_RESET = "\033[0m"
C_CORAL = "\033[38;2;217;119;87m"   # #d97757
C_MUTED = "\033[38;2;138;132;122m"  # #8a847a
C_TRACK = "\033[38;2;52;50;46m"     # #34322e (empty bar cells)

FILL_CHAR = "█"
EMPTY_CHAR = "░"
SEP = f"{C_MUTED}│{C_RESET}"


# ----------------------------------------------------------------------------
# Formatting helpers
# ----------------------------------------------------------------------------
def fmt_tokens(n: int) -> str:
    """Human-readable token count: 940 -> 940, 124300 -> 124k, 2_500_000 -> 2.5M."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M".replace(".0M", "M")
    if n >= 1_000:
        return f"{n / 1_000:.0f}k"
    return str(n)


def fmt_credits(credits: float) -> str:
    """AI-credit amount: whole numbers bare, otherwise one decimal (0 -> '0')."""
    if credits == 0:
        return "0"
    if credits >= 100 or credits == int(credits):
        return f"{credits:,.0f}"
    return f"{credits:,.1f}"


def render_bar(pct: float) -> str:
    """A fixed-width unicode bar in coral, clamped to [0, 100]."""
    pct = max(0.0, min(100.0, pct))
    filled = round(pct / 100 * BAR_WIDTH)
    return (
        f"{C_CORAL}{FILL_CHAR * filled}{C_RESET}"
        f"{C_TRACK}{EMPTY_CHAR * (BAR_WIDTH - filled)}{C_RESET}"
    )


# ----------------------------------------------------------------------------
# Context window (from stdin) — Copilot passes exact live numbers, no transcript
# parsing needed.
# ----------------------------------------------------------------------------
def context_segment(payload: dict) -> str:
    cw = payload.get("context_window") or {}
    cur = _int(cw.get("current_context_tokens")) or _int(cw.get("total_tokens"))
    limit = (
        _int(cw.get("displayed_context_limit"))
        or _int(cw.get("context_window_size"))
        or CONTEXT_WINDOW
    )
    pct = cw.get("current_context_used_percentage")
    if not isinstance(pct, (int, float)):
        pct = cur / limit * 100 if limit else 0
    value = f"{fmt_tokens(cur)}/{fmt_tokens(limit)}"
    return f"{C_MUTED}ctx{C_RESET} {render_bar(float(pct))} {C_CORAL}{value}{C_RESET}"


def _int(v: object) -> int:
    return v if isinstance(v, int) and not isinstance(v, bool) else 0


# ----------------------------------------------------------------------------
# Month-to-date AI credits — summed from persisted session event logs, cached.
# ----------------------------------------------------------------------------
def _month_start_ts() -> float:
    now = datetime.now()
    return datetime(now.year, now.month, 1).timestamp()


def _same_month(iso: str, ref: datetime) -> bool:
    try:
        when = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone()
    except (ValueError, TypeError, AttributeError):
        return False
    return when.year == ref.year and when.month == ref.month


def _sum_month_nano() -> int:
    """Σ totalNanoAiu over current-month assistant.usage events across all sessions."""
    ref = datetime.now()
    floor = _month_start_ts()
    total = 0
    for path in glob.glob(str(SESSION_STATE / "*" / "events.jsonl")):
        try:
            # A session touched only before this month can't hold current-month
            # events; skip it without opening the file.
            if os.path.getmtime(path) < floor:
                continue
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    total += _nano_of(line, ref)
        except OSError:
            continue
    return total


def _nano_of(line: str, ref: datetime) -> int:
    try:
        event = json.loads(line)
    except (json.JSONDecodeError, ValueError):
        return 0
    if not isinstance(event, dict) or event.get("type") != "assistant.usage":
        return 0
    if not _same_month(event.get("timestamp", ""), ref):
        return 0
    usage = (event.get("data") or {}).get("copilotUsage") or {}
    nano = usage.get("totalNanoAiu")
    return int(nano) if isinstance(nano, (int, float)) and not isinstance(nano, bool) else 0


def monthly_credits() -> float:
    """Current-month AI credits, cached for USAGE_TTL to keep renders cheap."""
    month = datetime.now().strftime("%Y-%m")
    try:
        cached = json.loads(USAGE_CACHE.read_text())
        age = time.time() - USAGE_CACHE.stat().st_mtime
        if cached.get("month") == month and age <= USAGE_TTL:
            return cached["total_nano_aiu"] / NANO_PER_CREDIT
    except (OSError, json.JSONDecodeError, ValueError, KeyError, TypeError):
        pass
    total = _sum_month_nano()
    _write_cache({"month": month, "total_nano_aiu": total})
    return total / NANO_PER_CREDIT


def _write_cache(data: dict) -> None:
    """Atomically persist the monthly total with owner-only permissions."""
    tmp = USAGE_CACHE.with_suffix(".tmp")
    try:
        tmp.write_text(json.dumps(data))
        os.chmod(tmp, 0o600)
        os.replace(tmp, USAGE_CACHE)
    except OSError:
        pass


# ----------------------------------------------------------------------------
# Render
# ----------------------------------------------------------------------------
def cwd_folder(payload: dict) -> str:
    """Basename of the working directory (workspace.current_dir, then cwd)."""
    cwd = (payload.get("workspace") or {}).get("current_dir") or payload.get("cwd") or os.getcwd()
    return os.path.basename(cwd.rstrip(os.sep)) or cwd


def build_status(payload: dict) -> str:
    model = (payload.get("model") or {}).get("display_name") or "copilot"

    ctx_seg = context_segment(payload)

    credits = monthly_credits()
    mo_seg = f"{C_MUTED}mo{C_RESET} {C_CORAL}{fmt_credits(credits)} cr{C_RESET}"

    dir_seg = f"{C_MUTED}dir {C_RESET}{C_CORAL}{cwd_folder(payload)}{C_RESET}"

    return f" {C_CORAL}{model}{C_RESET} {SEP} {ctx_seg} {SEP} {mo_seg} {SEP} {dir_seg}"


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except (json.JSONDecodeError, ValueError):
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    try:
        sys.stdout.write(build_status(payload))
    except Exception:  # noqa: BLE001 — the footer must never break the CLI
        model = (payload.get("model") or {}).get("display_name") or "copilot"
        sys.stdout.write(f" {C_CORAL}{model}{C_RESET}")


if __name__ == "__main__":
    main()
