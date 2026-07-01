#!/usr/bin/env bash
# SessionEnd — prune stale state to bound growth of hooks/state/
find "$HOME/.claude/hooks/state" -maxdepth 1 -type d -mtime +7 ! -name state ! -name digests ! -name logs -exec rm -rf {} + 2>/dev/null
find "$HOME/.claude/hooks/state/logs" -maxdepth 1 -type f -mtime +7 -delete 2>/dev/null
find "$HOME/.claude/hooks/state/digests" -maxdepth 1 -type f -mtime +30 -delete 2>/dev/null
exit 0
