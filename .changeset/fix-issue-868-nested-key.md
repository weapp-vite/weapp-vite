---
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复 `v-for` 的 `:key` 使用嵌套成员路径时被截断的问题，确保 `entry.item.id` 正确生成 `wx:key="item.id"`。
