---
"wevu": patch
"create-weapp-vite": patch
---

收紧 `wevu` 路由类型：`switchTab` 现在使用仅绝对路径的独立类型约束，并支持通过 `WevuTypedRouterRouteMap.tabBarEntries` 进一步收窄为 tabBar 页面联合类型；未声明时回退到 `entries`。同时补充对应的类型测试与文档说明，明确 `switchTab` 不接受相对路径和查询参数。
