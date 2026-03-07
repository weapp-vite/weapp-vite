---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu/router` 的动态路径匹配能力：当通过路径形式导航到动态命名路由（如 `/pages/post/42/index`）时，现在可以正确推断路由记录并注入 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
