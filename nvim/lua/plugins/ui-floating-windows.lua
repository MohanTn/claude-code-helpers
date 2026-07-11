-- Customize floating window colors (which-key, LSP info, code actions)
-- Makes floating panels more visually distinct from the main editor

return {
  {
    "folke/snacks.nvim",
    opts = {
      picker = {
        layout = {
          backdrop = 100, -- More opaque backdrop
        },
        win = {
          input = {
            keys = {
              ["<Esc>"] = { "close", mode = "n" },
            },
          },
        },
      },
    },
  },
  {
    "folke/which-key.nvim",
    opts = {
      win = {
        border = "rounded", -- Better visual separation
        no_overlap = false,
        padding = { 1, 2 }, -- Add padding
        title = true,
        title_pos = "center",
      },
      layout = {
        spacing = 10, -- Increase spacing between items
        align = "left",
      },
      preset = "helix", -- Cleaner layout
      -- Custom highlights for better visibility
      icons = {
        breadcrumb = "»",
        separator = "➜",
        group = "+",
        ellipsis = "…",
        mappings = false,
      },
    },
  },
  {
    "neovim/nvim-lspconfig",
    opts = function(_, opts)
      -- Customize LSP float window styling
      local lspconfig = require("lspconfig")
      local handlers = {}

      -- Enhanced hover and signature help styling
      handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, {
        border = "rounded",
        max_width = 80,
        max_height = 30,
      })

      handlers["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, {
        border = "rounded",
        max_width = 80,
        max_height = 20,
      })

      opts.handlers = handlers
      return opts
    end,
  },
}
