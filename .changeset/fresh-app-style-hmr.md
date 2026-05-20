---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复页面或组件热更新时可能重复写入 `app.wxss` 的问题，避免 Vite/Tailwind 已处理的应用级样式被原始 SFC 样式覆盖，并减少无关样式产物写入。
