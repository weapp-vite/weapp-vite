---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 在开发模式下的 `autoImportComponents` 热更新路径。此前 `autoImport` 插件在 dev 的后续 `buildStart` 中会重复全量扫描组件 globs；现在改为在首次扫描后通过 sidecar watcher 增量处理新增/删除组件文件，避免每次热更新都重新遍历整个组件目录，从而减少 `autoImportComponents` 对热更新耗时的影响。
