#!/usr/bin/env bash
# sessionEnd — prune stale hook state. Copilot hook state lives in the same
# ~/.local/state/claude-hooks tree the Claude hooks use (see lib/common.sh),
# so this simply runs the same age-based pruning.
exec bash "$HOME/.claude/hooks/session-end-cleanup.sh"
