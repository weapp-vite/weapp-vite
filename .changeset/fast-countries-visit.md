---
"weapp-vite": minor
"@weapp-core/init": patch
---

### weapp-vite

- `autoImportComponents.resolvers` 新增支持 **对象写法**（推荐），同时保持对历史 **函数写法** 的兼容。
- 内置 `VantResolver` / `TDesignResolver` / `WeuiResolver` 已切换为对象 resolver：优先走 `resolve()` / `components`，再回退到函数 resolver。
- 第三方组件库 props 元数据解析从硬编码迁移为 resolver 自描述（`resolveExternalMetadataCandidates`），并加入候选路径的启发式兜底。

> 注意：如果你此前在业务代码里直接调用内置 resolver（例如 `VantResolver()('van-button', ...)`），现在应改为交给 weapp-vite 处理，或自行调用 `resolver.resolve(...)`。

### @weapp-core/init

- 修复单测依赖：在测试启动阶段同步生成 `templates/`，并加入锁防止并发同步导致的偶发失败。
