---
"wevu": patch
"create-weapp-vite": patch
---

补齐 `wevu/router` 的 `RouteLocation` 最小字段模型：新增 `hash` / `name` / `params`（含 `RouteParamsRaw` 归一化），并支持从 `fullPath` 解析 `hash`。为保持小程序兼容，原生 `navigateTo/redirectTo` 发送的 URL 会自动忽略 `hash`，仅在路由语义层保留该字段。
