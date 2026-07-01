#!/usr/bin/env bash
# Bootstraps this repo's Claude Code / tmux / Neovim config onto the current
# machine by symlinking each item into place. Safe to re-run: already-linked
# items are skipped, and any pre-existing real file/dir at the destination is
# either migrated into the repo (first run on a machine that still has the
# live config) or backed up (fresh machine where the repo already owns the
# content).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

link() {
  local src="$1" dst="$2"

  if [ -L "$dst" ] && [ "$(readlink -f "$dst")" = "$(readlink -f "$src")" ]; then
    echo "= already linked: $dst"
    return
  fi

  if [ -e "$src" ]; then
    if [ -e "$dst" ] || [ -L "$dst" ]; then
      local backup="$dst.bak.$(date +%Y%m%d-%H%M%S)"
      mv "$dst" "$backup"
      echo "! backed up existing $dst -> $backup"
    fi
  elif [ -e "$dst" ] || [ -L "$dst" ]; then
    mkdir -p "$(dirname "$src")"
    mv "$dst" "$src"
    echo "> migrated $dst -> $src"
  else
    echo "? skipping, neither exists: $src / $dst"
    return
  fi

  mkdir -p "$(dirname "$dst")"
  ln -s "$src" "$dst"
  echo "+ linked $dst -> $src"
}

link "$SCRIPT_DIR/claude/settings.json"       "$HOME/.claude/settings.json"
link "$SCRIPT_DIR/claude/statusline-usage.py" "$HOME/.claude/statusline-usage.py"
link "$SCRIPT_DIR/claude/hooks"               "$HOME/.claude/hooks"
link "$SCRIPT_DIR/claude/skills"              "$HOME/.claude/skills"
link "$SCRIPT_DIR/claude/agents"              "$HOME/.claude/agents"
link "$SCRIPT_DIR/claude/commands"            "$HOME/.claude/commands"
link "$SCRIPT_DIR/claude/CLAUDE.md"           "$HOME/.claude/CLAUDE.md"
link "$SCRIPT_DIR/tmux/tmux.conf"             "$HOME/.tmux.conf"
link "$SCRIPT_DIR/nvim"                       "$HOME/.config/nvim"

echo
echo "Done. If anything was migrated above, review it with 'git status' in"
echo "$SCRIPT_DIR and commit/push to save it."
