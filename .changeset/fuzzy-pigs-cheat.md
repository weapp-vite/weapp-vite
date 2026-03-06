---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu` 新增子路径入口 `wevu/store` 与 `wevu/api`，其中 `wevu/api` 直接透传 `@wevu/api` 的能力，便于按需导入并保持与独立 API 包的一致接口。
