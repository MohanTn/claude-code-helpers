#!/usr/bin/env bash
# PreCompact — clear the read-cache: after compaction the transcript summary no
# longer contains file contents, so a cached "already read, unchanged" hash would
# wrongly tell Claude to reuse content it can no longer see.
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

rm -f "$state_dir"/read_* 2>/dev/null
log "pre-compact: cleared read cache"
exit 0
