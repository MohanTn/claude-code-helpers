{ ... }:

{
  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;
  };

  # kickstart.nvim (lazy.nvim-based, C#/TypeScript LSP servers added), vendored
  # under nvim/ and symlinked straight at this checkout, same as every other
  # tool in this repo. Plugin/LSP installs still happen at runtime under
  # stdpath('data') (~/.local/share/nvim), same as npm/pip caches elsewhere.
  home.file.".config/nvim".source = ../nvim;
}
