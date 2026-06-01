---
"weapp-vite": patch
"create-weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
---

优化 wevu 编译产物的内部运行时导入，将响应式 API 与模板 helper 分流到更小的内部入口，避免从 `wevu` 导入 `ref`、`nextTick`、`normalizeClass` 等轻量能力时固定拉入完整组件运行时 vendor。同步发布 create-weapp-vite，保持脚手架模板依赖版本与本次修复一致。
