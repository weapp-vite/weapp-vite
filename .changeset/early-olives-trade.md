---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 增加 `namedRoutes` 的运行时解析能力：支持 `{ name, params }` 在 `resolve/push/replace` 中映射到真实页面路径，并在静态路径命中时回填 `route.name`；同时对未配置路由名或缺失必填参数统一产出 `NavigationFailureType.unknown`（默认按 `rejectOnError` 拒绝），让命名导航行为更贴近 Vue Router 心智模型。
