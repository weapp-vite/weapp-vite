---
title: JS 配置
description: weapp-vite 内置集成了 vite-tsconfig-paths，用于读取
  tsconfig.json/jsconfig.json 的 paths/baseUrl，把别名映射到 Vite/Rolldown 流程中。
keywords:
  - 配置
  - config
  - js
  - weapp-vite
  - 内置集成了
  - vite-tsconfig-paths
  - 用于读取
---

# JS 配置 {#js-config}

`weapp-vite` 内置集成了 `vite-tsconfig-paths`，用于读取 `tsconfig.json/jsconfig.json` 的 `paths/baseUrl`，把别名映射到 Vite/Rolldown 流程中。

[[toc]]

## `weapp.tsconfigPaths` {#weapp-tsconfigpaths}
- **类型**：`TsconfigPathsOptions | false`
- **默认值**：`undefined`（按需自动启用）

启用规则：
- 当 `tsconfig.json` 或 `jsconfig.json` **存在 `paths` 或 `baseUrl`** 时，会自动启用该插件；
- 若你显式配置 `weapp.tsconfigPaths`，则以你的配置为准；
- 传入 `false` 可完全禁用（适合没有别名需求、追求更快启动的项目）。

```ts
import { defineConfig } from 'weapp-vite/config'
import type { PluginOptions } from 'vite-tsconfig-paths'

const tsconfigOptions: PluginOptions = {
  projects: ['./tsconfig.base.json'],
  extensions: ['.ts', '.js', '.vue'],
  exclude: ['**/__tests__/**'],
}

export default defineConfig({
  weapp: {
    tsconfigPaths: tsconfigOptions,
  },
})
```

### 与 `resolve.alias` 的关系

- `weapp.tsconfigPaths` 负责把 **tsconfig 的 paths/baseUrl** 转成 Vite alias。
- 你仍然可以在 `resolve.alias` 中补充或覆盖特定映射，两者可共存。

```ts
export default defineConfig({
  resolve: {
    alias: {
      '@shared': '/packages/shared/src',
    },
  },
  weapp: {
    tsconfigPaths: {
      projects: ['./tsconfig.base.json'],
    },
  },
})
```

### 常见问题

- **修改 `paths` 没生效？** 需要重启 `pnpm dev`，并确认 tsconfig 在 `projects` 列表内。
- **JSON 别名怎么配？** JSON 使用 `weapp.jsonAlias`（见 [JSON 配置](/config/json.md#weapp-jsonalias)），与 JS/TS 别名相互独立。

---

更多 alias 实战与疑难排查，请参考 [路径别名指南](/guide/alias)。
