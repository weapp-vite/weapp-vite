---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享样式依赖 HMR 的首轮刷新策略：`css-importer` 只选择代表入口触发构建，同时保留全部受影响样式作为 HMR 输出范围，避免 shared chunk 图把纯样式更新扩展成多入口 JS 重建。
