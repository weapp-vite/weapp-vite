---
'weapp-vite': patch
'create-weapp-vite': patch
---

将 `weapp` 平台默认 `build.target` 提升到 `es2020`，避免 `?.` / `??` 进入 Rolldown 的可选链降级分支；同时将历史上的 `weapp.es5` / `@swc/core` ES5 降级方案标记为已废弃，并统一将仓库内示例与 e2e 小程序的 `project.config.json` 打开 ES6 支持，配合开发者工具中的「将 JS 编译成 ES5」功能使用。
