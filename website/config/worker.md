---
title: Worker 配置
description: 当 app.json 配置了 workers 目录，weapp-vite 可以帮助编译 Worker 入口脚本。
keywords:
  - 配置
  - config
  - worker
  - 当
  - app.json
  - 配置了
  - workers
---

# Worker 配置 {#worker-config}

当 `app.json` 配置了 `workers` 目录，`weapp-vite` 可以帮助编译 Worker 入口脚本。

[[toc]]

## `weapp.worker` {#weapp-worker}
- **类型**：
  ```ts
  {
    entry?: string | string[]
  }
  ```
- **默认值**：`undefined`

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    worker: {
      entry: ['calc.ts', 'image.ts'],
    },
  },
})
```

说明：
- `entry` 为 **相对于 `app.json.workers` 目录** 的路径。
- 若未写扩展名，会自动尝试 `.js/.ts`。
- Worker 构建会复用 TS/别名/依赖解析能力，并输出到同一 `dist/` 目录下的 `workers/` 目录。

常见问题：
- **未指定 `entry` 会怎样？** 不会额外构建 Worker；你可以自行维护产物，但无法享受自动编译。
- **Worker 入口不存在？** 构建时会输出警告，并跳过该入口。

---

更多调试手段请见 [共享配置 · weapp.debug](/config/shared.md#weapp-debug)。
