# claude-code-helpers

Reproducible machine setup as a Nix flake: Claude Code config, zsh + oh-my-zsh, git, tmux, Neovim (LazyVim), pi extensions, and every tool they depend on. Clone it on any Linux box or WSL distro, run one script, and the machine is set up the way I like it.

```
flake.nix     inputs (pinned nixpkgs + home-manager) and CI checks
nix/          one Home Manager module per concern:
              packages, zsh, git, claude, tmux, nvim, pi
claude/       ~/.claude/{settings.json,CLAUDE.md,hooks,skills,commands,statusline-usage.py}
tmux/         ~/.tmux.conf
nvim/         ~/.config/nvim (LazyVim)
pi/           ~/.pi/agent/extensions
setup.sh      single entry point: setup, apply/update, drift audit, input upgrade
```

## New machine (Linux or WSL)

The config assumes the user is `mohan` and the repo lives at `~/REPO/claude-code-helpers` (on a fresh WSL distro, pick `mohan` as the username during setup).

```
git clone git@github.com:MohanTn/claude-code-helpers.git ~/REPO/claude-code-helpers
~/REPO/claude-code-helpers/setup.sh
```

`setup.sh` installs Nix (Determinate Systems installer) if missing, activates the Home Manager configuration (conflicting existing files are kept as `*.hm-backup`), switches the login shell to zsh, and finishes with a drift audit. Everything Nix-installed is pinned by `flake.lock`, so every machine gets identical versions.

### Secrets (required after first run)

Secrets are never committed. Machine-local values go in `~/.zshrc.local`, which the managed zshrc sources last:

```
export PIPELINE_WORKER_GITHUB_TOKEN="github_pat_..."
```

### Not managed by Nix (by design)

* **Claude Code, pi, and the other npm CLIs** (`pipeline-worker`, `gemini-cli`, `freebuff`, `mcp-sonar-analysis`, `@github/copilot`): these self-update and move fast, so activation bootstraps them via their native installers only when missing (claude to `~/.local/bin`, npm globals to `~/.npm-global`).
* **Docker daemon**: a system service, manual install per <https://docs.docker.com/engine/install/>.

## Making changes

Configs are served read-only from the Nix store, so the workflow is: edit the file in this repo, then apply and commit. `setup.sh` is also the update command; re-running it is a no-op when nothing changed.

```
./setup.sh          # apply repo changes (wraps home-manager switch)
git add -A && git commit -m "..." && git push
```

Every change is forced through Nix: the live files under `$HOME` are read-only store symlinks, and each `./setup.sh` run reverts anything that was replaced by hand (the hand-edited copy is kept as `*.hm-backup`). To audit without changing anything:

```
./setup.sh doctor   # verify every managed config still points into the Nix store; exit 1 on drift
```

Two deliberate exceptions:

* **`~/.config/nvim`** points straight at `nvim/` in this checkout (LazyVim needs to write `lazy-lock.json` on `:Lazy update`), so nvim edits are live without a switch. `lazy-lock.json` is committed to pin plugin versions; run `:Lazy restore` on a new machine to match it.
* **`~/.claude/settings.json`** is a writable copy, because Claude Code writes to it at runtime (permission grants, `/config`). Each switch refreshes it from the repo; if the live file had drifted, the old version is kept as `settings.json.hm-prev`. To keep runtime changes, copy them back into `claude/settings.json` before switching.

Updating pinned packages:

```
./setup.sh upgrade  # nix flake update + apply; review and commit flake.lock
```

## Testing

`nix flake check` runs all CI gates locally: it builds the full home configuration, runs the hook regression suite, and lints + tests `setup.sh` (shellcheck plus doctor drift-audit cases against a synthetic Home Manager profile). The hooks can also be exercised directly:

```
claude/hooks/test-hook.sh list                           # list hooks + what each does
claude/hooks/test-hook.sh run pre-tool-use-edit-guard.sh # run with a built-in sample payload
echo '{"...":"..."}' | claude/hooks/test-hook.sh run <hook.sh> -   # custom payload
claude/hooks/test-hook.sh selftest                       # regression checks
```

Hook runtime state (session logs, loop counters, digests) lives under `~/.local/state/claude-hooks/`, never in this repo.

## WSL notes

* Zed (the GUI editor) needs WSLg, which is standard on Windows 11.
* tmux copy-mode uses `wl-clipboard` on Wayland; on WSL, `set -g set-clipboard on` (OSC52) handles copying through the terminal instead.
* `wslu` provides `wslview` for opening URLs and files in Windows.
