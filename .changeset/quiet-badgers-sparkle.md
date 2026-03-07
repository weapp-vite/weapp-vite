---
"wevu": patch
"create-weapp-vite": patch
---

增强 `wevu/router` 的重名路由告警可读性：`routes` / `namedRoutes` 冲突时会输出来源与路径变化（例如 `routes:/old -> namedRoutes:/new`），帮助快速定位覆盖来源。

同时补齐动态路由替换的回归覆盖：`addRoute()` 同名替换后，验证 alias、beforeEnter、redirect、children 清理与静态匹配索引均按新记录生效，避免旧链路残留。
