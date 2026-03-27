---
'weapp-vite': patch
'create-weapp-vite': patch
---

回退 Rolldown 到 `1.0.0-rc.11`，临时规避 `weapp-vite@6.11.6` 在小程序 `dev/watch` 模式下二次增量构建触发的 `[FILE_NAME_CONFLICT]` 告警，并同步模板 catalog 依赖版本。
