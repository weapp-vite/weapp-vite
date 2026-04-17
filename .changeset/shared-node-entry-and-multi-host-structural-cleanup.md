---
'@weapp-core/shared': patch
'@weapp-vite/web': patch
'wevu': patch
'create-weapp-vite': patch
---

收拢 `@weapp-core/shared` 的 Node 专用入口，让 `@weapp-core/shared/node` 同时提供 `objectHash` 与 `fs` 能力，并继续保持根入口对小程序运行时安全。与此同时，清理 `@weapp-vite/web` 与 `wevu` 中残留的微信单宿主结构假设：`web` 的模板编译/legacy 渲染现已统一识别 `wx`、`a`、`tt`、`s` 等结构指令前缀，`wevu` 也补充了更中立的 `MiniProgram*` IntrinsicElements 类型别名与相关导出。
