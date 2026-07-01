#!/usr/bin/env bash
# Bootstraps this repo's Claude Code / tmux / Neovim setup onto the current
# machine: installs whatever required packages are missing (skips ones
# already present), then symlinks each config item into place. Safe to
# re-run: already-linked items are skipped, and any pre-existing real
# file/dir at the destination is either migrated into the repo (first run on
# a machine that still has the live config) or backed up (fresh machine
# where the repo already owns the content).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

### Packages ##################################################################
# Only what this config actually uses: git/nvim/tmux themselves, ripgrep+fd
# (Telescope), a C compiler (Treesitter parser builds), node/npm (the
# typescript/tailwind/json/prettier LazyVim extras in nvim/lazyvim.json), and
# wl-clipboard (tmux.conf's copy-mode bindings pipe through wl-copy).

PKG_MGR=""
if command -v apt-get >/dev/null 2>&1; then PKG_MGR=apt
elif command -v dnf >/dev/null 2>&1; then PKG_MGR=dnf
elif command -v pacman >/dev/null 2>&1; then PKG_MGR=pacman
elif command -v brew >/dev/null 2>&1; then PKG_MGR=brew
fi

apt_updated=0
pkg_install() {
  case "$PKG_MGR" in
    apt)
      if [ "$apt_updated" -eq 0 ]; then sudo apt-get update -qq; apt_updated=1; fi
      sudo apt-get install -y "$@" ;;
    dnf) sudo dnf install -y "$@" ;;
    pacman) sudo pacman -S --noconfirm "$@" ;;
    brew) brew install "$@" ;;
    *) echo "! no supported package manager found; install manually: $*" >&2; return 1 ;;
  esac
}

ensure_bin() {
  local bin="$1"; shift
  if command -v "$bin" >/dev/null 2>&1; then
    echo "= $bin already installed"
    return
  fi
  echo "> installing $bin ($*)"
  pkg_install "$@"
}

echo "--- packages ---"

if [ -z "$PKG_MGR" ]; then
  echo "! unsupported OS: no apt/dnf/pacman/brew found. Install git, tmux, neovim (>=0.9), ripgrep, fd, nodejs/npm, a C compiler and wl-clipboard manually."
else
  ensure_bin git git
  ensure_bin tmux tmux
  ensure_bin nvim neovim
  ensure_bin rg ripgrep
  ensure_bin npm nodejs npm
  [ "$PKG_MGR" != brew ] && ensure_bin wl-copy wl-clipboard

  if command -v gcc >/dev/null 2>&1 && command -v make >/dev/null 2>&1; then
    echo "= build tools already installed"
  elif [ "$PKG_MGR" = apt ]; then
    ensure_bin gcc build-essential
  else
    ensure_bin gcc gcc make
  fi

  # Debian/Ubuntu's fd-find package installs the binary as `fdfind`, not `fd`.
  if command -v fd >/dev/null 2>&1; then
    echo "= fd already installed"
  elif [ "$PKG_MGR" = apt ]; then
    pkg_install fd-find
    mkdir -p "$HOME/.local/bin"
    ln -sf "$(command -v fdfind)" "$HOME/.local/bin/fd"
    echo "+ installed fd-find, symlinked ~/.local/bin/fd -> fdfind"
  else
    ensure_bin fd fd
  fi
fi

if command -v nvim >/dev/null 2>&1; then
  nvim_minor="$(nvim --version | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1)"
  if [ "$(printf '%s\n%s\n' "$nvim_minor" 0.9 | sort -V | head -1)" != "0.9" ]; then
    echo "! nvim $nvim_minor is older than the 0.9 LazyVim requires; upgrade manually (PPA/AppImage)"
  fi
fi

### Config symlinks ############################################################

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
