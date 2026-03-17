---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 在 `hmr.sharedChunks = 'auto'` 下的增量更新策略。现在直接编辑页面、组件、样式与模板时，会优先保持增量 emit，不再因为共享 chunk importer 信息暂时不完整就退化成全量重发；当共享依赖变更触发受影响 entry 失效时，再按已知 shared importer 关系扩散，并在局部构建后增量刷新 importer 映射。这样可以显著降低模板项目等多入口场景下的开发态热更新耗时，同时保留 `auto` 模式对共享 chunk 变更的安全兜底。
