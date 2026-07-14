#!/usr/bin/env python3
"""Unit tests for the Copilot CLI status line (statusline-usage.py).

Run: python3 copilot/statusline-usage.test.py
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "statusline-usage.py"


def _iso_this_month(day: int = 15) -> str:
    now = datetime.now()
    return datetime(now.year, now.month, day, 12, 0, 0).isoformat()


def _iso_prev_month() -> str:
    now = datetime.now()
    year, month = (now.year - 1, 12) if now.month == 1 else (now.year, now.month - 1)
    return datetime(year, month, 15, 12, 0, 0).isoformat()


def _usage_event(iso: str, nano: int) -> str:
    return json.dumps(
        {"type": "assistant.usage", "timestamp": iso, "data": {"copilotUsage": {"totalNanoAiu": nano}}}
    )


def _load_module(copilot_dir: Path):
    """Import statusline-usage.py fresh with COPILOT_CONFIG_DIR pointed at a fixture."""
    os.environ["COPILOT_CONFIG_DIR"] = str(copilot_dir)
    spec = importlib.util.spec_from_file_location(f"sl_{id(copilot_dir)}", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class MonthlyCreditsTest(unittest.TestCase):
    def _fixture(self, tmp: str) -> Path:
        copilot_dir = Path(tmp) / ".copilot"
        sess = copilot_dir / "session-state" / "sess-a"
        sess.mkdir(parents=True)
        lines = [
            _usage_event(_iso_this_month(3), 20_000_000_000),   # 20 credits, counted
            _usage_event(_iso_this_month(9), 14_200_000_000),   # 14.2 credits, counted
            _usage_event(_iso_prev_month(), 99_000_000_000),    # prior month, ignored
            "{ this is not valid json",                          # malformed, skipped
            json.dumps({"type": "assistant.message", "timestamp": _iso_this_month()}),  # non-usage
        ]
        (sess / "events.jsonl").write_text("\n".join(lines) + "\n")
        return copilot_dir

    def test_sums_only_current_month(self):
        with tempfile.TemporaryDirectory() as tmp:
            mod = _load_module(self._fixture(tmp))
            self.assertAlmostEqual(mod.monthly_credits(), 34.2, places=6)

    def test_cache_written_and_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            copilot_dir = self._fixture(tmp)
            mod = _load_module(copilot_dir)
            mod.monthly_credits()
            cache = json.loads((copilot_dir / ".statusline-usage-cache.json").read_text())
            self.assertEqual(cache["total_nano_aiu"], 34_200_000_000)
            self.assertEqual(cache["month"], datetime.now().strftime("%Y-%m"))

    def test_no_sessions_is_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / ".copilot").mkdir()
            mod = _load_module(Path(tmp) / ".copilot")
            self.assertEqual(mod.monthly_credits(), 0.0)


class RenderTest(unittest.TestCase):
    def test_context_and_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / ".copilot").mkdir()
            mod = _load_module(Path(tmp) / ".copilot")
            payload = {
                "model": {"display_name": "gpt-5.4"},
                "workspace": {"current_dir": "/x/y/mohan-dotfiles"},
                "context_window": {"current_context_tokens": 48000, "displayed_context_limit": 128000},
            }
            line = mod.build_status(payload)
            self.assertIn("gpt-5.4", line)
            self.assertIn("48k/128k", line)
            self.assertIn("mohan-dotfiles", line)
            self.assertIn("mo", line)

    def test_credits_formatting(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / ".copilot").mkdir()
            mod = _load_module(Path(tmp) / ".copilot")
            self.assertEqual(mod.fmt_credits(0), "0")
            self.assertEqual(mod.fmt_credits(34.2), "34.2")
            self.assertEqual(mod.fmt_credits(12.0), "12")
            self.assertEqual(mod.fmt_credits(1234.5), "1,234")


class ContractTest(unittest.TestCase):
    """The footer command must always exit 0 and print exactly one line."""

    def _run(self, stdin: str) -> subprocess.CompletedProcess:
        with tempfile.TemporaryDirectory() as tmp:
            env = {**os.environ, "COPILOT_CONFIG_DIR": str(Path(tmp) / ".copilot")}
            (Path(tmp) / ".copilot").mkdir()
            return subprocess.run(
                [sys.executable, str(SCRIPT)],
                input=stdin, capture_output=True, text=True, env=env,
            )

    def test_empty_stdin(self):
        res = self._run("")
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.count("\n"), 0)  # single line, no trailing newline
        self.assertIn("copilot", res.stdout)

    def test_garbage_stdin(self):
        res = self._run("}{not json")
        self.assertEqual(res.returncode, 0)
        self.assertIn("copilot", res.stdout)


if __name__ == "__main__":
    unittest.main()
