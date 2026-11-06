---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-vite/tailwindcss": patch
"@weapp-vite/dashboard": patch
"@weapp-vite/glass-easel-web-adapter": patch
---

chore(deps): 升级小程序样式引擎、SWC 和浏览器测试依赖，同步脚手架生成的依赖版本。Tailwind compiler 升级到 5.7.1，采用上游动态透明度修复，并同步普通及固定版本配置。

独立 Sass 升级到 1.108.0；sass-embedded 暂保留 1.107.1 并限制低于 1.108.0，避免官方 Windows 发行包缺少编译器文件导致构建失败。
