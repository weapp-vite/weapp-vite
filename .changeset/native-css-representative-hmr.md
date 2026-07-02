---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享样式依赖 HMR 的代表入口选择：当 `.vue` 入口先进入 dirty 队列但同时存在原生 TS/JS 入口时，优先使用原生入口触发 bundler 增量构建，同时保留完整样式 HMR 输出范围，减少纯样式依赖更新时不必要的 Vue 编译开销。
