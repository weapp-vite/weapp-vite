---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 调整 `removeRoute(name)` 在 `children` 场景下的行为：删除父路由时会连带删除其子路由记录，避免出现父路由已移除但子路由仍可匹配的状态偏差，更贴近 Vue Router 心智模型。
