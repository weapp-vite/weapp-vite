---
'weapp-vite': patch
'create-weapp-vite': patch
---

将 Vite 回退到 `8.0.2`，恢复其默认依赖的 `rolldown@1.0.0-rc.11`，临时规避小程序 `dev/watch` 模式下二次增量构建触发的 `[FILE_NAME_CONFLICT]` 告警。
