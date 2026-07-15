{ config, pkgs, ... }:

{
  programs.tmux = {
    enable = true;
    clock24 = true;
    escapeTime = 0;
    historyLimit = 10000;
    keyMode = "vi";
    mouse = true;

    # Plugins are pulled from nixpkgs and wired into tmux.conf at build time,
    # so there's no TPM runtime clone step (`prefix + I`) or ~/.tmux/plugins
    # directory living outside the Nix store.
    plugins = with pkgs.tmuxPlugins; [
      sensible
      {
        plugin = catppuccin;
        extraConfig = ''
          set -g @catppuccin_flavor "mocha"
          # "rounded" needs Powerline U+E0B4-E0B7 glyphs, which Ptyxis/VTE
          # renders as stray Greek letters (Omega, Phi) on this machine even
          # though the font itself has the correct glyph outlines; "basic"
          # avoids those codepoints entirely.
          set -g @catppuccin_window_status_style "basic"
          # status-right modules (directory/session/date_time) default this
          # to the same broken U+E0B6 glyph independently of the window
          # style above; clear it too.
          set -g @catppuccin_status_left_separator ""
        '';
      }
    ];

    extraConfig = ''
      set -g status-position bottom
      set -g status-left ""
      set -g status-right-length 100
      set -g status-right "#{E:@catppuccin_status_directory}#{E:@catppuccin_status_session}#{E:@catppuccin_status_date_time}"
    '';
  };
}
