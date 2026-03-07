---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu` 新增 `wevu/fetch` 子路径导出，基于 `@wevu/api` 的 `wpi.request` 提供与标准 `fetch` 对齐的核心行为：返回 `Promise<Response>`、HTTP 非 2xx 不抛错、网络失败抛 `TypeError`、支持 `AbortSignal` 取消、并对 `GET/HEAD` 携带 `body` 进行一致性校验。

