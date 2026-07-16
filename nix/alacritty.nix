{ ... }:

{
  # Glyph install is in packages.nix (nerd-fonts.jetbrains-mono); the "Mono"
  # face keeps Powerline/icon glyphs single-width in the grid, matching the
  # font convention set in ptyxis.nix.
  programs.alacritty = {
    enable = true;
    settings = {
      font = {
        normal.family = "JetBrainsMono Nerd Font Mono";
        size = 12;
      };
    };
  };
}
