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

## Making changes

Edit the files directly (they're symlinked, so you're editing the repo), then:

```
git add -A && git commit -m "..." && git push
```
