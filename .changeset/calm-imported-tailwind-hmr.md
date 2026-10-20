---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-vite/tailwindcss": patch
---

fix(weapp-vite): 修复导入 Tailwind 入口的普通 CSS 和 Vue 样式在状态化 HMR 中触发完整重载的问题，保留页面状态，并继续通过原生构建管线处理 scoped 样式、PostCSS 和资源 URL。快照输入、依赖或样式入口在编译期间变化时，仍会安全执行完整重同步。
