---
"weapp-vite-wevu-tailwindcss-tdesign-template": patch
"create-weapp-vite": patch
---

修复 wevu + Tailwind CSS + TDesign 模板在微信开发者工具中默认启用 Skyline/GlassEasel 后可能触发 `Error: timeout` 的问题。模板现在默认使用稳定的 WebView 组件运行时，并在项目私有配置中同步关闭 Skyline 与 DevTools compile hot reload，避免 DevTools 导入、启动或保存后重新进入不兼容的运行时/缓存组合。
