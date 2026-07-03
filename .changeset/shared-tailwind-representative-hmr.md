---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享 TypeScript 依赖、Vue 页面 Tailwind 内容刷新、CSS importer fallback 与外部 Vue style sidecar 的 HMR 调度：共享 chunk 和 CSS fallback 刷新保留完整受影响入口集合用于样式与输出刷新，但实际只选择必要入口参与加载和 chunk emit；同名 Vue 外部样式变更直接归属到对应 Vue entry，减少 Tailwind app 样式刷新时的多入口重复重建开销。
