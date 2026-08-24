---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp.styles.include` 显式匹配 `app.vue` 时未向 `app.wxss` 注入共享样式的问题，同时保持默认配置不修改应用级样式入口。
