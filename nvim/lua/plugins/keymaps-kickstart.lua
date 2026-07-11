-- Kickstart.nvim style keymaps for LazyVim
-- Lazy-loads after Telescope and LSP are available

return {
  {
    "nvim-telescope/telescope.nvim",
    keys = {
      -- ========================================================================
      -- TELESCOPE: SEARCH KEYMAPS (Kickstart style: <leader>s<char>)
      -- ========================================================================
      { "<leader>sh", function() require("telescope.builtin").help_tags() end, desc = "Search Help" },
      { "<leader>sk", function() require("telescope.builtin").keymaps() end, desc = "Search Keymaps" },
      { "<leader>sf", function() require("telescope.builtin").find_files() end, desc = "Search Files" },
      { "<leader>ss", function() require("telescope.builtin").builtin() end, desc = "Search Telescope Built-ins" },
      { "<leader>sw", function() require("telescope.builtin").grep_string() end, desc = "Search word under cursor" },
      { "<leader>sg", function() require("telescope.builtin").live_grep() end, desc = "Search by grep (live)" },
      { "<leader>sd", function() require("telescope.builtin").diagnostics() end, desc = "Search Diagnostics" },
      { "<leader>sr", function() require("telescope.builtin").resume() end, desc = "Resume previous search" },
      { "<leader>s.", function() require("telescope.builtin").oldfiles() end, desc = "Search Recent Files" },
      { "<leader>sc", function() require("telescope.builtin").commands() end, desc = "Search Commands" },
      {
        "<leader><leader>",
        function() require("telescope.builtin").buffers() end,
        desc = "Search Buffers (switch)",
      },
      {
        "<leader>/",
        function()
          require("telescope.builtin").current_buffer_fuzzy_find(require("telescope.themes").get_dropdown({
            winblend = 10,
            previewer = false,
          }))
        end,
        desc = "Fuzzily search current buffer",
      },
      {
        "<leader>s/",
        function()
          require("telescope.builtin").live_grep({
            grep_open_files = true,
            prompt_title = "Live grep in open files",
          })
        end,
        desc = "Search in open files",
      },
      {
        "<leader>sn",
        function()
          require("telescope.builtin").find_files({
            cwd = vim.fn.stdpath("config"),
            prompt_title = "Search Neovim config",
          })
        end,
        desc = "Search Neovim config",
      },
    },
  },
  {
    "neovim/nvim-lspconfig",
    keys = {
      -- ========================================================================
      -- LSP ACTIONS (Kickstart style: gr<char> for LSP)
      -- ========================================================================
      { "grn", vim.lsp.buf.rename, desc = "Rename symbol" },
      { "gra", vim.lsp.buf.code_action, desc = "Code actions" },
      { "gra", vim.lsp.buf.code_action, desc = "Code actions", mode = "x" },
      { "grD", vim.lsp.buf.declaration, desc = "Goto declaration" },
      { "grd", vim.lsp.buf.definition, desc = "Goto definition" },
      { "grt", vim.lsp.buf.type_definition, desc = "Goto type definition" },
      {
        "grr",
        function() require("telescope.builtin").lsp_references() end,
        desc = "Find references",
      },
      {
        "gri",
        function() require("telescope.builtin").lsp_implementations() end,
        desc = "Goto implementation",
      },
      {
        "gO",
        function() require("telescope.builtin").lsp_document_symbols() end,
        desc = "Document symbols",
      },
      {
        "gW",
        function() require("telescope.builtin").lsp_dynamic_workspace_symbols() end,
        desc = "Workspace symbols",
      },
      {
        "<leader>th",
        function()
          if vim.lsp.inlay_hint then
            vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
          end
        end,
        desc = "Toggle inlay hints",
      },
    },
  },
  {
    "conform.nvim",
    keys = {
      -- ========================================================================
      -- FORMATTING (uses conform.nvim via LazyVim)
      -- ========================================================================
      {
        "<leader>f",
        function()
          require("conform").format({ async = true, lsp_fallback = true })
        end,
        desc = "Format buffer",
      },
      {
        "<leader>f",
        function()
          require("conform").format({ async = true, lsp_fallback = true })
        end,
        desc = "Format selection",
        mode = "v",
      },
    },
  },
}
