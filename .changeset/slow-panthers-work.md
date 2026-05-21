---
"@wevu/compiler": patch
---

修复同名 `slot` 在 `v-if` / `v-else` 条件分支中的输出错误，确保具名插槽的两个分支都会按条件保留，不再把 `v-else` 分支拍平成普通节点。
