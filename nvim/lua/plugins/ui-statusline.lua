-- Customize statusline (Lualine) with improved colors for better visual separation
-- Uses a brighter theme section with distinct background colors

return {
  {
    "nvim-lualine/lualine.nvim",
    event = "VeryLazy",
    opts = function(_, opts)
      -- Enhanced theme with better contrast
      local theme = {
        normal = {
          a = { bg = "#7aa2f7", fg = "#1f2335", gui = "bold" },      -- Blue background for mode (bright)
          b = { bg = "#3b4261", fg = "#a9b1d6" },                    -- Darker gray, light text
          c = { bg = "#24283b", fg = "#7aa2f7" },                    -- Dark bg, blue text
        },
        insert = {
          a = { bg = "#9ece6a", fg = "#1f2335", gui = "bold" },      -- Green background
          b = { bg = "#3b4261", fg = "#9ece6a" },
          c = { bg = "#24283b", fg = "#9ece6a" },
        },
        visual = {
          a = { bg = "#bb9af7", fg = "#1f2335", gui = "bold" },      -- Purple background
          b = { bg = "#3b4261", fg = "#bb9af7" },
          c = { bg = "#24283b", fg = "#bb9af7" },
        },
        replace = {
          a = { bg = "#f7768e", fg = "#1f2335", gui = "bold" },      -- Red/pink background
          b = { bg = "#3b4261", fg = "#f7768e" },
          c = { bg = "#24283b", fg = "#f7768e" },
        },
        command = {
          a = { bg = "#e0af68", fg = "#1f2335", gui = "bold" },      -- Yellow/orange background
          b = { bg = "#3b4261", fg = "#e0af68" },
          c = { bg = "#24283b", fg = "#e0af68" },
        },
        inactive = {
          a = { bg = "#3b4261", fg = "#7aa2f7" },
          b = { bg = "#24283b", fg = "#565f89" },
          c = { bg = "#24283b", fg = "#565f89" },
        },
      }

      opts.options = vim.tbl_deep_extend("force", opts.options or {}, {
        theme = theme,
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
        padding = { left = 1, right = 1 },
      })

      -- Enhance sections with better spacing and visibility
      opts.sections = vim.tbl_deep_extend("force", opts.sections or {}, {
        lualine_a = { "mode" },
        lualine_b = {
          { "branch", icon = "" },
          { "diff", symbols = { added = " ", modified = " ", removed = " " } },
        },
        lualine_c = {
          { "filename", path = 1, symbols = { modified = "●", readonly = "🔒", unnamed = "[No Name]" } },
        },
        lualine_x = {
          { "diagnostics", symbols = { error = " ", warn = " ", info = " ", hint = " " } },
          "encoding",
          "fileformat",
          "filetype",
        },
        lualine_y = { "progress" },
        lualine_z = { "location" },
      })

      return opts
    end,
  },
}
