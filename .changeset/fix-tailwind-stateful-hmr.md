---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复内置 `weapp-tailwindcss` 启用后 Vue 脚本变更被错误降级为全量 HMR 的问题，确保 JavaScript 增量补丁与 Tailwind 样式快照能够正确协同更新。
