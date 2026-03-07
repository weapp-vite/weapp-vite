---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `router.options` 只读配置快照，用于按 Vue Router 心智读取初始化参数（如 `paramsMode/maxRedirects/namedRoutes/tabBarEntries`）。该快照在路由器创建时确定，不会随着 `addRoute/removeRoute/clearRoutes` 的运行时变更而漂移，便于调试与诊断。
