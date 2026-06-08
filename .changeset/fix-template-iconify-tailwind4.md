---
"@weapp-vite/dashboard": patch
"create-weapp-vite": patch
---

模板中的 Tailwind v4 图标插件从 `@egoist/tailwindcss-icons` 迁移到 `@iconify/tailwind4`，并移除模板里的 `tailwind.config.ts`，让 Tailwind 扫描与插件配置统一由 `src/app.css` 管理。
