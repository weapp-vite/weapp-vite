---
"weapp-vite": minor
"@weapp-vite/dashboard": minor
"create-weapp-vite": minor
---

将 `--ui` 调试链路迁移到 Devframe RPC 与 shared state，保留受限文件读取，并把 Dashboard 重构为面向构建、包体、运行事件和诊断的高密度 DevTools 工作台，新增基于 D3 的可缩放 Chunk 静态/动态依赖图，同时修正 mixed vendor 的稳定命名，避免业务依赖被误归属到 `wevu-runtime` 产物。
