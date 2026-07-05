# claude-code-helpers

Personal dotfiles: Claude Code config, tmux, Neovim, and Pi agent extensions, kept portable via symlinks.

```
claude/     ~/.claude/{settings.json,statusline-usage.py,hooks,skills,agents,commands,CLAUDE.md}
tmux/       ~/.tmux.conf
nvim/       ~/.config/nvim
pi/         ~/.pi/agent/extensions/{hooks,pipeline-panel}
install.sh  symlinks everything above into place, and installs the pi CLI itself
```

## New machine

```
git clone git@github.com:MohanTn/claude-code-helpers.git ~/REPO/claude-code-helpers
~/REPO/claude-code-helpers/install.sh
```

## Testing a hook manually

`claude/hooks/test-hook.sh` invokes a hook script the same way Claude Code does (a JSON payload on stdin) and reports its exit code, stdout, and stderr:

```
claude/hooks/test-hook.sh list                          # list hooks + what each does
claude/hooks/test-hook.sh run pre-tool-use-edit-guard.sh # run with a built-in sample payload
echo '{"...":"..."}' | claude/hooks/test-hook.sh run <hook.sh> -   # run with a custom payload
claude/hooks/test-hook.sh selftest                       # regression checks for the hooks themselves
```

## Pi agent

`pi/agent/extensions/` holds two extensions for the [Pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) (`@earendil-works/pi-coding-agent`), symlinked into `~/.pi/agent/extensions/` by `install.sh`, which also installs the `pi` CLI itself via `npm install -g` if it isn't already on `PATH`:

- `hooks/` — a TypeScript port of the same guard/goal/loop-breaker behavior as `claude/hooks`, wired into Pi's extension lifecycle instead of Claude Code's hook events: session-start digest injection, GOAL capture + YAGNI/self-check prompting, edit/write no-op guards, import resolution + `tsc`/`dotnet build` gates, `sonar_lite.py` static analysis, and the consecutive-tool-call loop breaker. It intentionally excludes anything `claude/hooks` has since dropped (bash-command dedup, read caching, architecture hints, TTS/ding, pre-compact) — keep the two in sync when one changes.
- `pipeline-panel/` — a full-screen dashboard extension for launching and watching `pipeline-worker` runs (worktree, MR/PR, CI) from inside Pi.

Each extension has its own test suite (`node:test` + `tsx`):

```
cd pi/agent/extensions/hooks && npm install && npm test        # or: npm run typecheck
cd pi/agent/extensions/pipeline-panel && npm install && npm test
```

## Making changes

Edit the files directly (they're symlinked, so you're editing the repo), then:

```
git add -A && git commit -m "..." && git push
```
