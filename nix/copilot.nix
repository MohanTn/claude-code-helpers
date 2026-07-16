{ config, ... }:

{
  # Copilot CLI hooks: the personal hook suite (Copilot ports of the Claude
  # hooks in claude/hooks, reusing those scripts via payload translation) plus
  # the scaffold-toolkit adapter wiring. Copilot parses every *.json under
  # ~/.copilot/hooks/ recursively (verified 1.0.70; the docs claim top-level
  # only), so the adapter checkout must live outside that directory or its
  # package.json is rejected as an invalid hook config on every session start.
  # The rest of ~/.copilot (settings.json, session state) stays unmanaged
  # because Copilot writes to it at runtime.
  home.file.".copilot/hooks".source = ../copilot/hooks;

  # Live link to the adapter checkout (same role as claude/hooks/scaffold for
  # Claude Code). mkOutOfStoreSymlink rather than a repo-tracked symlink:
  # home.file dereferences a symlink source into a store snapshot, which would
  # freeze the adapter at switch time instead of following the checkout.
  home.file.".copilot/scaffold".source = config.lib.file.mkOutOfStoreSymlink
    "/run/media/mohan/M/REPO/scaffold-toolkit/packages/adapter-copilot-cli";

  # Expose the tool-agnostic scaffold-pack-author skill to Copilot CLI, which
  # discovers skills as directories under ~/.copilot/skills/ (verified 1.0.70:
  # skills.getDiscoveryPaths joins homedir/.copilot/skills). Claude Code already
  # gets this skill via claude.nix linking agents/skills to ~/.claude/skills; we
  # link only the one subdir here so Copilot does not also surface the
  # Claude-artifact-specific skills (arch, featurePlan) it cannot render.
  home.file.".copilot/skills/scaffold-pack-author".source =
    ../agents/skills/scaffold-pack-author;

  # Copilot CLI has no @-import directive (unlike claude/CLAUDE.md's
  # `@~/.agents/AGENTS.md`), so the global instructions are generated at
  # eval time from the same source instead of hand-duplicated: this reads
  # agents/AGENTS.md into the store file's content, so agents/AGENTS.md
  # stays the single authored system prompt and copilot-instructions.md is
  # never edited directly.
  home.file.".copilot/copilot-instructions.md".text =
    builtins.readFile ../agents/AGENTS.md;
}
