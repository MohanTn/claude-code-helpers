return {
  "sindrets/diffview.nvim",
  cmd = { "DiffviewOpen", "DiffviewClose", "DiffviewFileHistory" },
  keys = {
    { "<leader>gd", "<cmd>DiffviewOpen<cr>", desc = "Diff View (all changes)" },
    { "<leader>gh", "<cmd>DiffviewFileHistory %<cr>", desc = "File History" },
  },
}
