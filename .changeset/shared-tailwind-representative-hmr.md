---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化共享 TypeScript 依赖、Vue 页面 Tailwind 内容刷新、CSS importer fallback 与外部 Vue style sidecar 的 HMR 调度：共享 chunk 和 CSS fallback 刷新保留完整受影响入口集合用于样式与输出刷新，但实际只选择必要入口参与加载和 chunk emit；Vue JSON 宏字符串变更不再误触发 Tailwind 内容刷新，并由 JSON-only metadata 自身触发必要资源刷新，同名 Vue 外部样式变更直接归属到对应 Vue entry，减少 Tailwind app 样式刷新时的多入口重复重建开销；dev 模式下会等待自动导入组件 watcher 就绪后再完成初始构建，并在页面模板先看到新增本地组件但注册尚未完成时按 auto-import globs 补注册已存在的候选文件，避免新增 SFC 组件导致 usingComponents HMR 偶发漏刷。
