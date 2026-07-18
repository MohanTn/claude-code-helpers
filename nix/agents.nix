{ pkgs, lib, ... }:

{
  # The tool-agnostic agents layer: AGENTS.md (global instructions,
  # referenced by claude/CLAUDE.md) and skills/ (also linked to
  # ~/.claude/skills by claude.nix so Claude Code discovers them).
  # Whole-directory link is safe here because ~/.agents is not shared with
  # any other home.file target (unlike ~/.claude, which already owns its
  # whole subtree).
  home.file.".agents".source = ../agents;

  # scaffold.js's handlebars dep: node_modules/ is gitignored, so the flake
  # source (and therefore the ~/.agents store symlink) never contains it.
  # Install the locked deps into a writable cache that scaffold.js falls
  # back to; re-runs only when the lockfile changes.
  home.activation.boilerplatsDeps = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    cacheDir="$HOME/.cache/boilerplats"
    srcLock=${../agents/boilerplats/package-lock.json}
    if [ ! -d "$cacheDir/node_modules" ] || ! cmp -s "$srcLock" "$cacheDir/package-lock.json"; then
      run mkdir -p "$cacheDir"
      run install -m 0644 ${../agents/boilerplats/package.json} "$cacheDir/package.json"
      run install -m 0644 "$srcLock" "$cacheDir/package-lock.json"
      run ${pkgs.nodejs}/bin/npm ci --prefix "$cacheDir" --no-fund --no-audit
    fi
  '';
}
