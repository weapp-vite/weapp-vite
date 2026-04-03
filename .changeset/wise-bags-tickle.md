---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite --ui` / `weapp-vite build --ui` / `weapp-vite dev --ui` 在消费端项目中优先启动 `@weapp-vite/dashboard` 源码工程的问题。现在 UI 模式统一服务 dashboard 已编译的 `dist` 静态资源，避免用户项目里的 Tailwind / PostCSS 配置继续参与 dashboard 样式编译，从而消除与 Tailwind 3、Tailwind 4 或自定义 PostCSS 流水线的冲突。
