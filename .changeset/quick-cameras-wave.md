---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 完善 `children` 场景下的路由记录 `redirect` 执行语义：当目标命中父子匹配链时，会按匹配链优先处理父级 `redirect`。一旦命中重定向，后续子路由守卫将不再执行，行为更贴近 Vue Router 嵌套路由心智模型。
