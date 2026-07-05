# claude-code-helpers

Personal dotfiles: Claude Code config, tmux, and Neovim, kept portable via symlinks.

```
claude/     ~/.claude/{settings.json,statusline-usage.py,hooks,skills,agents,commands,CLAUDE.md}
tmux/       ~/.tmux.conf
nvim/       ~/.config/nvim
install.sh  symlinks everything above into place
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

## Making changes

Edit the files directly (they're symlinked, so you're editing the repo), then:

```
git add -A && git commit -m "..." && git push
```
