---
"create-weapp-vite": patch
"weapp-vite-tailwindcss-tdesign-template": patch
"weapp-vite-tailwindcss-vant-template": patch
"weapp-vite-wevu-tailwindcss-tdesign-template": patch
---

修复脚手架模板中部分 `vite.config.ts` 的 import 排序，避免生成项目或模板仓库在执行 ESLint / CI Policy 检查时触发 `perfectionist/sort-imports` 错误，确保模板与 `create-weapp-vite` 产物保持一致。
