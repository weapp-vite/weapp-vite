---
"create-weapp-vite": patch
---

将所有内置 Tailwind 模板升级到 Tailwind CSS 4，统一切换到 `@tailwindcss/postcss`、`src/app.css` 入口和 `cssEntries` 配置，确保脚手架生成的新项目默认使用 Tailwind 4 并能被 `weapp-tailwindcss` 正常转译。
