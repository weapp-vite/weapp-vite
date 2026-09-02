---
'@weapp-vite/web': patch
---

将 Web 运行时依赖解析延迟到 Vite 插件配置阶段，避免 Node.js 专用模块泄漏到浏览器运行时产物；同时支持按小程序包的 `miniprogram` 字段解析组件，并让 Sass 查找 pnpm 提升后的工作区依赖。
