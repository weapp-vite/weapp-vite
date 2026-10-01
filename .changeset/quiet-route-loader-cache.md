---
"weapp-vite": patch
"create-weapp-vite": patch
---

路由入口增删时清除实际入口加载器的解析与输出缓存，避免拓扑刷新沿用旧页面信息。
