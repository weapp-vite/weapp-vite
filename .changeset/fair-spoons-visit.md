---
"wevu": patch
"create-weapp-vite": patch
---

完善 `wevu/router` 在嵌套路由场景下的 `alias` 语义：当父路由声明 `alias` 且子路由使用相对路径时，子路由会自动继承并展开父级 alias 路径，使 `resolve()`、路径匹配和守卫链在 alias 链路下保持一致。

同时补齐运行时 `addRoute(parentName, route)` 的行为一致性，确保动态注册的子路由同样继承父级 alias；并新增对应单测与对齐矩阵文档更新。
