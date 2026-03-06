---
"wevu": patch
"create-weapp-vite": patch
---

增强 `wevu/router` 的解析结果与路由记录行为：`resolve()` 结果新增 `href/matched/redirectedFrom` 扩展字段（可选），并在导航重定向链路中透出来源位置信息；同时补齐 `RouteRecordRaw` 子集能力的回归测试，覆盖 `meta` 注入、`beforeEnter` 与记录级 `redirect` 行为。
