{ pkgs, lib, config, ... }:

{
  home.file = {
    ".claude/CLAUDE.md".source = ../claude/CLAUDE.md;
    ".claude/statusline-usage.py".source = ../claude/statusline-usage.py;
    ".claude/hooks".source = ../claude/hooks;
    ".claude/skills".source = ../agents/skills;
  };

  # Live link to the scaffold-toolkit adapter checkout (same role as
  # .copilot/scaffold in copilot.nix). mkOutOfStoreSymlink rather than a
  # repo-tracked symlink: home.file dereferences a symlink source into a
  # store snapshot, which would freeze the adapter at switch time instead of
  # following the checkout. Kept as a sibling of .claude/hooks, not nested
  # inside it, since .claude/hooks is itself a whole-directory store symlink
  # and can't also host an independently-managed child symlink.
  home.file.".claude/scaffold".source = config.lib.file.mkOutOfStoreSymlink
    "${config.home.homeDirectory}/REPO/scaffold-toolkit";

  # settings.json is the one config file Claude Code itself edits at runtime
  # (permission grants, /config), so it is deployed as a writable copy that
  # each switch refreshes from the repo. If the live file drifted since the
  # last switch, the previous version is kept next to it for diffing.
  home.activation.claudeSettings = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    claudeDir="$HOME/.claude"
    src=${../claude/settings.json}
    dst="$claudeDir/settings.json"
    run mkdir -p "$claudeDir"
    if [ -f "$dst" ] && [ ! -L "$dst" ] && ! cmp -s "$src" "$dst"; then
      run cp "$dst" "$dst.hm-prev"
    fi
    # a legacy install.sh symlink must go first, or install would write
    # through it into the repo checkout
    if [ -L "$dst" ]; then
      run rm "$dst"
    fi
    run install -m 0644 "$src" "$dst"
  '';

  # Claude Code itself stays on the official native installer so it keeps
  # self-updating; only bootstrap it when missing.
  home.activation.installClaude = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ ! -x "$HOME/.local/bin/claude" ] && ! command -v claude >/dev/null 2>&1; then
      run ${pkgs.bash}/bin/bash -c '${pkgs.curl}/bin/curl -fsSL https://claude.ai/install.sh | ${pkgs.bash}/bin/bash'
    fi
  '';
}
