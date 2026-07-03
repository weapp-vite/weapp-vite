---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享 TypeScript 依赖触发 Tailwind 内容刷新时的 HMR 调度：保留完整受影响入口集合用于样式与 shared chunk 输出刷新，但实际只选择一个 shared chunk 代表入口参与加载和 chunk emit，减少多入口重复重建开销。
