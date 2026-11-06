---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-vite/tailwindcss": patch
"@weapp-vite/dashboard": patch
"@weapp-vite/glass-easel-web-adapter": patch
---

chore(deps): 升级小程序样式引擎、SWC 和浏览器测试依赖，同步脚手架生成的依赖版本。保留 Tailwind compiler 5.6.3，并限制低于 5.7.0，避免动态透明度声明丢失和开发缓存复用退化。
