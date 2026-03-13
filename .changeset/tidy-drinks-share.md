---
'weapp-vite': patch
'create-weapp-vite': patch
---

默认开启 `weapp.autoRoutes`，并同步优化自动路由的初始化与增量扫描性能：仅在真正加载自动路由模块时才触发扫描与监听，优先遍历 `pages` 目录收集候选页面，同时增加基于文件时间戳的持久化缓存，减少冷启动和无变更场景下的重复全量扫描开销。
