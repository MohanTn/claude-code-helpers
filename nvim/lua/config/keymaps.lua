-- Basic keymaps that don't depend on lazy-loaded plugins
-- Telescope and LSP keymaps are in plugins/keymaps-kickstart.lua

local map = vim.keymap.set

-- ============================================================================
-- NAVIGATION & EDITING (Basic)
-- ============================================================================

-- Clear search highlights
map("n", "<Esc>", "<cmd>nohlsearch<CR>", { desc = "Clear search highlights" })

-- Window navigation with Ctrl+hjkl
map("n", "<C-h>", "<C-w><C-h>", { desc = "Move focus to left window" })
map("n", "<C-l>", "<C-w><C-l>", { desc = "Move focus to right window" })
map("n", "<C-j>", "<C-w><C-j>", { desc = "Move focus to lower window" })
map("n", "<C-k>", "<C-w><C-k>", { desc = "Move focus to upper window" })

-- Exit terminal mode
map("t", "<Esc><Esc>", "<C-\\><C-n>", { desc = "Exit terminal mode" })

-- ============================================================================
-- DIAGNOSTICS & QUICKFIX
-- ============================================================================

map("n", "<leader>q", vim.diagnostic.setloclist, { desc = "Open diagnostics quickfix list" })
