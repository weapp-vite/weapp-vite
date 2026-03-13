---
title: JS 配置
description: Weapp-vite 默认使用 Vite 8 原生的 resolve.tsconfigPaths
  读取 tsconfig.json/jsconfig.json 的 paths/baseUrl，并在需要高级选项时兼容 vite-tsconfig-paths。
keywords:
  - 配置
  - config
  - js
  - Weapp-vite
  - 内置集成了
  - resolve.tsconfigPaths
  - 用于读取
---

# JS 配置 {#js-config}

`weapp-vite` 默认使用 Vite 8 原生的 `resolve.tsconfigPaths` 读取 `tsconfig.json/jsconfig.json` 的 `paths/baseUrl`，把别名映射到 Vite / Rolldown 流程中；只有在你传入高级选项对象时，才会回退到 `vite-tsconfig-paths` 插件。

[[toc]]

## `weapp.tsconfigPaths` {#weapp-tsconfigpaths}
- **类型**：`boolean | TsconfigPathsOptions | false`
- **默认值**：`undefined`（按需自动启用）

启用规则：
- 当 `tsconfig.json` 或 `jsconfig.json` **存在 `paths` 或 `baseUrl`** 时，会自动启用 Vite 原生 `resolve.tsconfigPaths`；
- 传入 `true` 时，会强制启用原生 `resolve.tsconfigPaths`；
- 传入对象时，会启用 `vite-tsconfig-paths` 插件以支持 `projects`、`exclude` 等高级选项；
- 传入 `false` 可完全禁用（适合没有别名需求、追求更快启动的项目）。

推荐优先使用默认行为或 `true`，这样不会触发 Vite 8 对 `vite-tsconfig-paths` 的提示信息。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    tsconfigPaths: true,
  },
})
```

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

- `weapp.tsconfigPaths` / `resolve.tsconfigPaths` 负责把 **tsconfig 的 paths/baseUrl** 转成 Vite alias。
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
