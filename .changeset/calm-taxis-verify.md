---
"weapp-vite": patch
"create-weapp-vite": patch
"wevu": patch
---

支持原生支付宝项目直接使用 `.axml` / `.acss` 接入 weapp-vite，并让页面、组件、分包、自动路由、watcher 与原生 layout 按目标平台稳定选择 sidecar；原生支付宝语法保持不变，便携 WXML 和 Vue SFC 仍会转换为支付宝产物，因此原生页面与 Vue 页面可以在同一项目渐进共存。同时修复 `import-sjs` 被错误降级以及独立 SJS 被转换为 `module.exports` 的问题，并补充原生组件、原生分包、wevu runtime、`antd-mini` 与官方 `minidev` 编译复验。
