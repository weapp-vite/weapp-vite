---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享 Sass 样式依赖的热更新索引，支持追踪 `@use` / `@forward`，并在原生样式入口加载时同步 CSS import graph，避免共享样式变更回退刷新无关入口。
