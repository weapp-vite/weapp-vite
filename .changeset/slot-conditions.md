---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 模板中 `<slot />` 携带 `v-if` / `v-else-if` / `v-else` 时条件指令丢失的问题，确保编译到小程序模板后保留对应平台条件分支。
