---
'create-weapp-vite': patch
'weapp-vite': patch
---

将请求相关运行时注入能力收敛到 `weapp.appPrelude.requestRuntime`，统一用 `appPrelude` 表达前置执行时机，同时保留 `weapp.injectRequestGlobals` 作为过渡兼容配置。当前版本中旧配置仍可使用，但会输出废弃提示；当新旧配置同时存在时，会优先采用 `appPrelude.requestRuntime`。
