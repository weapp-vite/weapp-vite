---
title: 开发态 HMR 配置
description: 说明 weapp.hmr.sharedChunks 与 touchAppWxss 的默认行为、适用场景和取舍。
keywords:
  - 配置
  - config
  - hmr
  - sharedChunks
  - touchAppWxss
---

# 开发态 HMR 配置 {#hmr-config}

`weapp.hmr` 用来控制开发态更新时的“稳定性 vs 速度”取舍。本页只覆盖两项：

- `weapp.hmr.sharedChunks`
- `weapp.hmr.touchAppWxss`

[[toc]]

## `weapp.hmr.sharedChunks` {#weapp-hmr-sharedchunks}
- **类型**：`'full' | 'auto' | 'off'`
- **默认值**：`'auto'`
- **适用场景**：开发态 HMR 时控制共享 chunk 的重建策略。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      sharedChunks: 'auto',
    },
  },
})
```

取舍说明：
- `full`：每次更新都重新产出全部 entry，最稳但最慢。
- `auto`：只在共享 chunk 可能被覆盖时回退到 `full`，是默认折中方案。
- `off`：仅更新变更 entry，最快，但共享 chunk 导出关系复杂时更容易出现开发态不一致。

建议：
- 普通项目保持默认 `auto`。
- 遇到“开发态偶发错乱、刷新后恢复正常”的共享 chunk 问题时，优先尝试 `full`。
- 只有在你确认项目结构简单且极度在意 dev 重建速度时，再考虑 `off`。

## `weapp.hmr.touchAppWxss` {#weapp-hmr-touchappwxss}
- **类型**：`boolean | 'auto'`
- **默认值**：`'auto'`
- **适用场景**：开发态构建结束后，额外触碰 `app.wxss`，触发微信开发者工具的热重载。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      touchAppWxss: 'auto',
    },
  },
})
```

行为说明：
- `true`：总是启用。
- `false`：关闭。
- `auto`：检测到安装 `weapp-tailwindcss` 时启用。

适用建议：
- 如果你在开发者工具里经常遇到样式更新不稳定、必须手动刷新，优先检查这一项。
- 若项目未使用 `weapp-tailwindcss` 且样式热更新已经稳定，可保持默认或显式关闭。

## 关联阅读

- [共享 Chunk 配置](/config/chunks.md)
- [共享配置](/config/shared.md)
- [调试指南](/guide/debug.md)
