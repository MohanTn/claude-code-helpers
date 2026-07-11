-- Neovim options configuration
-- VS Code-style line numbers and other visual settings

-- ============================================================================
-- LINE NUMBERS: VS Code style (continuous absolute numbering)
-- ============================================================================
-- Show absolute line numbers like VS Code (1, 2, 3, 4, ...)
-- instead of relative numbers (0, 1, 2, 3, ...)
vim.opt.number = true
vim.opt.relativenumber = false

-- ============================================================================
-- VISUAL ENHANCEMENTS
-- ============================================================================
-- Show line where cursor is
vim.opt.cursorline = true

-- Number of lines to keep visible above/below cursor when scrolling
vim.opt.scrolloff = 8
vim.opt.sidescrolloff = 8

-- Show invisible characters (spaces, tabs, line endings)
vim.opt.list = true
vim.opt.listchars = { tab = "» ", trail = "·", nbsp = "␣" }

-- TEXT WRAPPING
-- Enable text wrapping
vim.opt.wrap = true
-- Wrap at word boundaries instead of character boundaries
vim.opt.linebreak = true
-- Indent wrapped lines to match indentation
vim.opt.breakindent = true
-- Show ↳ prefix for wrapped lines
vim.opt.showbreak = "↳ "

-- ============================================================================
-- INDENTATION
-- ============================================================================
-- Use spaces instead of tabs
vim.opt.expandtab = true
-- Size of indentation
vim.opt.shiftwidth = 2
-- Number of spaces for Tab key
vim.opt.tabstop = 2
-- Number of spaces per indentation level
vim.opt.softtabstop = 2

-- ============================================================================
-- SEARCH
-- ============================================================================
-- Ignore case in search patterns
vim.opt.ignorecase = true
-- Override ignorecase if search contains uppercase
vim.opt.smartcase = true
-- Highlight search matches
vim.opt.hlsearch = true

-- ============================================================================
-- WINDOW BEHAVIOR
-- ============================================================================
-- Split windows open to the right
vim.opt.splitright = true
-- Split windows open below
vim.opt.splitbelow = true
