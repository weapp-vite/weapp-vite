---
"wevu": patch
"create-weapp-vite": patch
---

放宽 `wevu/router` 的 `createRouter({ routes })` 类型约束，允许路由记录只传 `path`，无需显式提供 `name`。当未提供 `name` 时，运行时会基于规范化后的路由路径自动生成名称，现有按名称解析与路由守卫行为保持不变。
