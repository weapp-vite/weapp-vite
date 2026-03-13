---
'weapp-vite': patch
'create-weapp-vite': patch
---

将 `weapp.autoRoutes` 的默认值恢复为关闭，避免项目在未显式声明时自动启用路由扫描；同时保留 `true` 和对象配置两种开启方式，方便在需要时再按需启用并细化控制。
