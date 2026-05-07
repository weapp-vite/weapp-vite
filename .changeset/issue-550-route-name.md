---
"wevu": patch
---

修复已创建 router 后单独调用 `useRoute().name` 仍返回 `undefined` 的问题，现在当前页面路由状态会复用命名路由匹配结果补齐 `name`、`matched`、`meta` 与动态 `params`。
