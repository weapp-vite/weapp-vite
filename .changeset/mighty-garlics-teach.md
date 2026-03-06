---
"wevu": patch
"create-weapp-vite": patch
---

继续对齐 `wevu/router` 的 Vue Router 心智：
- `useRouter` 新增 `parseQuery` / `stringifyQuery` 配置钩子，支持按实例自定义查询解析与序列化。
- 增加 hash-only 导航判定策略：当路径与查询等价、仅 `hash` 变化时返回 `aborted` 失败，避免在小程序原生路由层触发无效跳转。
