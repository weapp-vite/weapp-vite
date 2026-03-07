---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 完善 `children` 场景下的 `beforeEnter` 执行语义：当目标命中父子链路时，`beforeEnter` 会按父到子顺序依次执行；若父级守卫返回重定向，后续子守卫将不再执行。该行为更贴近 Vue Router 的嵌套路由守卫心智模型。
