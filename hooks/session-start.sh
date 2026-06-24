#!/usr/bin/env bash
# SessionStart — 1.3 session/project digest, keyed by cwd since there's no single user-level CLAUDE.md
input=$(cat)
export HOOK_INPUT="$input"
source "$HOME/.claude/hooks/lib/common.sh"

proj_cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$proj_cwd" ] && proj_cwd="$PWD"

digest_dir="$HOOKS_HOME/state/digests"
mkdir -p "$digest_dir" 2>/dev/null
key=$(printf '%s' "$proj_cwd" | md5sum | cut -d' ' -f1)
digest="$digest_dir/${key}.md"
claude_md="$proj_cwd/CLAUDE.md"

needs_regen=0
if [ ! -f "$digest" ]; then
  needs_regen=1
elif [ -f "$claude_md" ] && [ "$claude_md" -nt "$digest" ]; then
  needs_regen=1
elif [ ! -f "$claude_md" ]; then
  age=$(( $(date +%s) - $(stat -c %Y "$digest" 2>/dev/null || echo 0) ))
  [ "$age" -gt 86400 ] && needs_regen=1
fi

if [ "$needs_regen" = "1" ]; then
  {
    echo "## Project digest for: $proj_cwd"
    if [ -f "$claude_md" ]; then
      echo "### CLAUDE.md (first 15 lines)"
      head -15 "$claude_md"
    fi
    if [ -f "$proj_cwd/package.json" ]; then
      echo "### package.json scripts"
      jq -r '.name as $n | "name: \($n)", (.scripts // {} | to_entries[] | "  \(.key): \(.value)")' "$proj_cwd/package.json" 2>/dev/null
    fi
    echo "### Top-level entries"
    ls -1 "$proj_cwd" 2>/dev/null | head -20
  } > "$digest" 2>/dev/null
  log "session-start: regenerated digest for $proj_cwd"
fi

cat "$digest" 2>/dev/null
exit 0
