-- Load options first (before lazy.nvim)
require("config.options")

-- bootstrap lazy.nvim, LazyVim and your plugins
require("config.lazy")

-- Load basic keymaps (that don't depend on lazy-loaded plugins)
-- Telescope and LSP keymaps are in plugins/keymaps-kickstart.lua
require("config.keymaps")
