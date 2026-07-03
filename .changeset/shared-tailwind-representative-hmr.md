---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享 TypeScript 依赖、Vue 页面 Tailwind 内容刷新与 CSS importer fallback 时的 HMR 调度：共享 chunk 和 CSS fallback 刷新保留完整受影响入口集合用于样式与输出刷新，但实际只选择必要入口参与加载和 chunk emit；Tailwind app 样式刷新改为 metadata 资产刷新，避免把 app entry 当作 JS shared chunk 依赖扩散源，减少多入口重复重建开销。
