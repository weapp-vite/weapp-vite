---
title: 开发态 HMR 配置
description: 说明 weapp.hmr.sharedChunks、touchAppWxss、logLevel 与 profileJson 的默认行为、适用场景和取舍。
keywords:
  - 配置
  - config
  - hmr
  - sharedChunks
  - touchAppWxss
  - logLevel
  - profileJson
---

# 开发态 HMR 配置 {#hmr-config}

`weapp.hmr` 用来控制开发态更新时的“稳定性 vs 速度”取舍，也可以打开更细的终端诊断与结构化 profile 输出。本页覆盖：

- `weapp.hmr.sharedChunks`
- `weapp.hmr.touchAppWxss`
- `weapp.hmr.logLevel`
- `weapp.hmr.profileJson`

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

## `weapp.hmr.logLevel` {#weapp-hmr-loglevel}

- **类型**：`'default' | 'concise' | 'verbose'`
- **默认值**：`'default'`
- **适用场景**：控制 HMR 终端日志的详细程度。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'concise',
    },
  },
})
```

行为说明：

- `default`：只输出总耗时等基础信息，适合日常开发。
- `concise`：输出关键阶段耗时，适合定位“哪一类更新慢”。
- `verbose`：输出更完整的阶段诊断，适合排查 HMR 链路异常。

建议：

- 日常保持 `default`。
- 只有在定位 HMR 慢、共享 chunk 回退或 DevTools 热重载不稳定时，再临时提高到 `concise` 或 `verbose`。

## `weapp.hmr.profileJson` {#weapp-hmr-profilejson}

- **类型**：`boolean | string`
- **默认值**：`false`
- **适用场景**：输出 HMR 结构化 profile，方便后续脚本、AI 或报告工具分析。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    hmr: {
      profileJson: '.tmp/weapp-vite-hmr-profile.jsonl',
    },
  },
})
```

行为说明：

- `false`：不输出结构化 profile。
- `true`：使用默认 profile 输出路径。
- 字符串：写入指定 JSONL 文件路径。

> [!TIP]
> 当你需要把 HMR 诊断交给 AI 或 CI 侧脚本复盘时，优先开启 `profileJson`，再结合 `logLevel: 'concise'` 或 `verbose` 缩小问题范围。

## 关联阅读

- [共享 Chunk 配置](/config/chunks.md)
- [共享配置](/config/shared.md)
- [调试指南](/guide/debug.md)
