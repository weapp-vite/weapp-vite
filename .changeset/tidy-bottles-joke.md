---
"wevu": patch
"create-weapp-vite": patch
---

收紧 `wevu` 路由类型：`switchTab` 现在使用仅绝对路径的独立类型约束，并支持通过 `WevuTypedRouterRouteMap.tabBarEntries` 进一步收窄为 tabBar 页面联合类型；未声明时回退到 `entries`。同时补充对应的类型测试与文档说明，明确 `switchTab` 不接受相对路径和查询参数。

同时修复一组运行时类型声明细节，消除 `wevu` 类型检查中的基线噪音：避免根导出里的重复 `ModelRef` 导出冲突，收敛 `setData` 适配器返回类型，并补齐若干严格模式下的显式类型注解。
