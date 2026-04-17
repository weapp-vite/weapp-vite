'weapp-vite': patch
'create-weapp-vite': patch
---

继续增强多平台路由导出体验：`weapp-vite/auto-routes` 在保留 `wxRouter` 兼容导出的同时，新增宿主中立的 `miniProgramRouter` 别名导出与对应类型 `AutoRoutesMiniProgramRouter`。这样在微信、支付宝、抖音等小程序场景下，业务代码可以优先使用更通用的命名，而不需要继续把路由调用心智绑定到单一宿主。
