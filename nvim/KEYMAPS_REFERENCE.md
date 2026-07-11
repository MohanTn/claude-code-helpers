# Kickstart.nvim Keymaps Added to LazyVim

This reference documents the keymaps imported from kickstart.nvim into your LazyVim setup.
See `lua/config/keymaps.lua` for implementation.

## Quick Reference

### Search Keymaps (Telescope)
All search commands use `<leader>s` prefix:

```
<leader>sh   →  Search help documentation
<leader>sk   →  Search keymaps (show what keys do what)
<leader>sf   →  Search files (find files in project)
<leader>ss   →  Search Telescope built-ins
<leader>sw   →  Search word under cursor
<leader>sg   →  Search by grep pattern (live grep)
<leader>sd   →  Search diagnostics
<leader>sr   →  Resume previous search
<leader>s.   →  Search recent files (oldfiles)
<leader>sc   →  Search commands
<leader>s/   →  Search in open files only
<leader>sn   →  Search Neovim config files
<leader>/    →  Fuzzy search current buffer
<leader><leader>  →  Switch between buffers
```

### LSP Keymaps
All LSP commands use `gr` prefix (mnemonic: "go referential"):

```
grn    →  Rename symbol (gr+n)
gra    →  Code actions (gr+a) - works in normal and visual mode
grr    →  Find references (gr+r)
gri    →  Goto implementation (gr+i)
grd    →  Goto definition (gr+d)
grt    →  Goto type definition (gr+t)
grD    →  Goto declaration (gr+D)
gO     →  Document symbols (outline)
gW     →  Workspace symbols
<leader>th  →  Toggle inlay hints
```

### Navigation
```
Ctrl+h   →  Move to left window
Ctrl+l   →  Move to right window
Ctrl+j   →  Move to lower window
Ctrl+k   →  Move to upper window
Esc      →  Clear search highlights (when not editing)
Esc+Esc  →  Exit terminal mode
```

### Utilities
```
<leader>q   →  Open diagnostics in quickfix list
<leader>f   →  Format buffer (normal or visual mode)
```

---

## Usage Examples

### Example 1: Find and open a file
```
<leader>sf    →  Opens file picker
                 Type filename and press Enter
```

### Example 2: Search for a function across the project
```
<leader>sg    →  Opens grep picker
                 Type function name and press Enter
```

### Example 3: Rename a variable under cursor
```
Position cursor on variable name
grn           →  Opens rename dialog
                 Type new name and press Enter
```

### Example 4: Browse LSP symbols in current file
```
gO            →  Opens document symbols picker
                 Navigate and press Enter to jump
```

### Example 5: Find where a function is used
```
Position cursor on function name
grr           →  Shows all references in quickfix
```

---

## How to Learn These

1. **View all keymaps in Neovim**:
   ```vim
   :Telescope keymaps
   ```
   Then search for "sf" or any keymap you want to find.

2. **See available commands visually**:
   ```vim
   :WhichKey   " or press <space> and wait 1 sec
   ```
   Look for "s" section to see all search commands.

3. **Quick reference in Neovim**:
   ```vim
   :help keymaps
   ```

---

## Differences from LazyVim Defaults

| Action | Kickstart Key | LazyVim Default | Note |
|--------|---------------|-----------------|------|
| Find files | `<leader>sf` | `<leader>ff` | Both work now |
| Live grep | `<leader>sg` | `<leader>/` | Both work now |
| Buffers | `<leader><leader>` | `<leader>fb` | Both work now |
| Code actions | `gra` | `<leader>ca` | Both work now |
| Rename | `grn` | `<leader>cr` | Both work now |
| Goto definition | `grd` | `gd` | Both work now |

All LazyVim keymaps continue to work alongside these kickstart keymaps.

---

## Custom Additions

These keymaps are not in vanilla kickstart but added for convenience:

- `<leader>s/` - Search only in open files (useful for focused searching)
- `<leader>sn` - Quick access to Neovim config files
- `<leader>f` in visual mode - Format selected text

---

## Modifying Keymaps

To add, remove, or change keymaps:

1. Edit `lua/config/keymaps.lua`
2. Restart Neovim or run `:source lua/config/keymaps.lua`
3. The changes take effect immediately

Example to add a new keymap:
```lua
map("n", "<leader>xx", function()
  -- your action here
end, { desc = "Your description" })
```
