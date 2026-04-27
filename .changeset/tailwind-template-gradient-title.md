---
"create-weapp-vite": patch
---

修复 Tailwind CSS 小程序模板中 `bg-clip-text` 渐变文字在微信端缺少兼容前缀的问题，所有内置 Tailwind 模板默认接入 `autoprefixer` 后处理。
