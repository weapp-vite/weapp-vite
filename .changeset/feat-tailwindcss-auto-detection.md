---
"create-weapp-vite": patch
"weapp-vite": patch
---

内置 Tailwind CSS 集成现在会在项目使用 Tailwind CSS v4 并实际引入 `@import "tailwindcss"` 时自动启用；同时自动禁用已注册的 `weapp-tailwindcss/vite` 外部插件并给出迁移提示，模板统一改用 `weapp.tailwindcss` 配置。
