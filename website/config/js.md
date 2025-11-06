# JS 配置 {#js-config}

脚本与模板中的路径别名通常依赖 `tsconfig.json` 与 Vite 的 `resolve.alias`。`weapp-vite` 内置了 `vite-tsconfig-paths`，并通过顶层的 `weapp.tsconfigPaths` 暴露高级选项，方便在 Monorepo 或复杂项目中精细控制解析行为。

[[toc]]

## `weapp.tsconfigPaths` {#weapp-tsconfigpaths}
- **类型**：`TsconfigPathsOptions`
- **默认值**：`undefined`
- **适用场景**：需要微调 `vite-tsconfig-paths`，例如指定额外的 `tsconfig`、忽略测试目录、扩展解析后缀等。

```ts
import { defineConfig } from 'weapp-vite/config'
import type { PluginOptions } from 'vite-tsconfig-paths'

const tsconfigOptions: PluginOptions = {
  projects: ['./tsconfig.base.json'],
  extensions: ['.ts', '.js'],
  exclude: ['**/__tests__/**'],
}

export default defineConfig({
  weapp: {
    tsconfigPaths: tsconfigOptions,
  },
})
```

### 常用字段

- `projects`: 指定一个或多个 `tsconfig` 文件，适合 Monorepo 或多入口项目。
- `exclude`: 配置 glob 以排除不需要解析的目录，减少扫描量。
- `extensions`: 手动扩展需要参与别名解析的后缀，如 `.vue`、`.mjs`、`.json`。

### 与 Vite `resolve.alias` 的关系

`weapp.tsconfigPaths` 会根据 `tsconfig` 中的 `compilerOptions.paths` 自动生成别名映射，并在 Vite/Rolldown 构建流程中生效。若需要覆盖默认行为或为特定文件类型追加绝对路径解析，可继续在 `resolve.alias` 中补充配置，两者可以共存：

```ts
import { defineConfig } from 'weapp-vite/config'

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

- **`paths` 修改后没有生效？** 确认 `tsconfig` 文件是否在 `projects` 列表内，或重新启动 `pnpm dev` 使缓存失效。
- **与 JSON 别名的区别？** `weapp.tsconfigPaths` 仅影响 JS/TS/WXML 等脚本模板。若希望在 JSON/JSONC 中使用别名，请查看 [JSON 配置](/config/json.md)。
- **如何支持多语言后缀？** 将需要解析的后缀加入 `extensions`，并确保对应文件由 Vite 插件处理（如 `.vue`、`.svelte` 等）。

---

更多 alias 实战与疑难排查，请参考 [路径别名指南](/guide/alias)。
