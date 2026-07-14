{ lib, ... }:

{
  # Copilot CLI owns ~/.copilot itself: config.json, mcp-config.json, and
  # session data are runtime state it writes, so the directory is never
  # linked as a whole (same policy as ~/.claude in claude.nix). Per-entry
  # links only: Copilot loads every *.json in ~/.copilot/hooks as a
  # user-level hook configuration (mohan-hooks.json points at the scripts
  # next to it), copilot-instructions.md as global user instructions,
  # agents/*.agent.md as custom agents, and skills/*/SKILL.md as personal
  # skills. Read-only store links mean in-CLI agent/skill creation to the
  # user location fails; add new ones in this repo instead.
  #
  # statusline-usage.py is the status line command (see settings.json below):
  # it reads Copilot's stdin JSON for model/context/folder and sums this
  # month's AI credits from ~/.copilot/session-state/*/events.jsonl.
  #
  # The Copilot CLI binary itself is installed by optional-packages.nix
  # (enableGitHubCopilot), intentionally unpinned like the other npm CLIs.
  home.file = {
    ".copilot/hooks".source = ../copilot/hooks;
    ".copilot/copilot-instructions.md".source = ../copilot/copilot-instructions.md;
    ".copilot/skills".source = ../copilot/skills;
    ".copilot/statusline-usage.py".source = ../copilot/statusline-usage.py;
  };

  # settings.json holds user config Copilot itself rewrites at runtime
  # (/statusline, /config), so it is deployed as a writable copy that each
  # switch refreshes from the repo. If the live file drifted since the last
  # switch, the previous version is kept next to it for diffing. Mirrors the
  # claudeSettings activation in claude.nix.
  home.activation.copilotSettings = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    copilotDir="$HOME/.copilot"
    src=${../copilot/settings.json}
    dst="$copilotDir/settings.json"
    run mkdir -p "$copilotDir"
    if [ -f "$dst" ] && [ ! -L "$dst" ] && ! cmp -s "$src" "$dst"; then
      run cp "$dst" "$dst.hm-prev"
    fi
    # a pre-existing store symlink must go first, or install would write
    # through it into the repo checkout
    if [ -L "$dst" ]; then
      run rm "$dst"
    fi
    run install -m 0644 "$src" "$dst"
  '';
}
