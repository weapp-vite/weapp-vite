---
"create-weapp-vite": patch
"weapp-vite-tailwindcss-template": patch
"weapp-vite-tailwindcss-tdesign-template": patch
"weapp-vite-tailwindcss-vant-template": patch
"weapp-vite-wevu-tailwindcss-tdesign-template": patch
"weapp-vite-wevu-tailwindcss-tdesign-retail-template": patch
---

移除 Tailwind CSS 4 模板中重复声明的业务层 autoprefixer 配置与依赖，改由 weapp-tailwindcss 的 Tailwind 4 内置 autoprefixer 后处理统一补齐小程序 WebView 兼容前缀。
