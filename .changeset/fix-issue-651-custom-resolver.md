---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 custom resolver 返回 Vue SFC 组件时的入口识别问题。现在 `resolvedId` 即使省略 `.vue` 后缀，也会按真实 SFC 入口解析并注入 Vue slot 元数据，同时保持组件样式参与构建输出。
