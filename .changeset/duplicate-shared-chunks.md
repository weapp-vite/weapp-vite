---
"weapp-vite": minor
---

默认分包共享模块的拆分策略由提炼到主包(`hoist`) 调整为按分包复制(`duplicate`)，跨分包复用的 `common.js` 将输出到各自分包的 `__shared__` 目录。若需要保持旧行为，请在 `vite.config.ts` 中设置 `weapp.chunks.sharedStrategy = 'hoist'`。
