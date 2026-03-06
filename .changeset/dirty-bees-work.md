---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu` 新增子路径入口 `wevu/router`，导出 `useRouter` / `usePageRouter` 及路由相关类型，便于按模块按需导入并统一路由类型约束。
