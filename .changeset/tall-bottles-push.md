---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `RouteRecordRaw.alias` 支持（字符串或字符串数组）。现在通过 alias 路径进行 `resolve/push/replace` 时，可以正确命中命名路由记录并推断 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
