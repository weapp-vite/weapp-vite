# JSON 别名与路径解析 {#json-and-alias}

`weapp-vite` 对小程序的 JSON / JSONC 文件做了增强，既允许你书写注释，也支持类似 Vite `resolve.alias` 的别名映射。本节将介绍如何为 JSON 配置别名，以及如何在编译阶段自定义 `tsconfig` 路径解析。

[[toc]]

## `weapp.jsonAlias` {#weapp-jsonalias}
- **类型**：`{ entries?: Record<string, string> | { find: string | RegExp; replacement: string }[] }`
- **默认值**：`undefined`
- **适用场景**：在大量页面/组件 JSON 中引用同一套公共组件、图标目录或插件路径，需要更易读的别名写法。

```ts
import path from 'node:path'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    jsonAlias: {
      entries: [
        { find: '@/components/', replacement: path.resolve(__dirname, 'src/components/') },
        { find: /^@icons\//, replacement: path.resolve(__dirname, 'src/assets/icons/') },
      ],
    },
  },
})
```

### 使用示例

配置完成后，你可以在任意 JSON/JSONC 中直接写：

```jsonc
{
  "usingComponents": {
    "nav-bar": "@/components/navigation-bar",
    "logo-icon": "@icons/logo"
  }
}
```

构建产物会自动转换成相对路径，确保最终小程序可以正确识别：

```json
{
  "usingComponents": {
    "nav-bar": "../../components/navigation-bar",
    "logo-icon": "../../assets/icons/logo"
  }
}
```

> **提示**：别名的匹配与 Vite 一致，既支持字符串也支持正则；当使用文件系统路径时请务必填入绝对路径。

### 与 `tsconfig` 配合

通常我们会同时在 `tsconfig.json` 中配置 `paths` 用于 JS/TS 别名：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

JS/TS 的别名由内置的 `vite-tsconfig-paths` 处理，JSON 的别名由 `jsonAlias` 处理，两者可以共存，互不影响。
更多实战示例请参考 [路径别名指南](/guide/alias)。

## `weapp.tsconfigPaths` {#weapp-tsconfigpaths}
- **类型**：`TsconfigPathsOptions`
- **默认值**：`undefined`
- **适用场景**：需要微调 `vite-tsconfig-paths` 行为，例如只启用某个 `tsconfig`、忽略测试目录等。

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

常用配置：

- `projects`: 指定多个 `tsconfig`，适用于 Monorepo。
- `exclude`: 过滤自动导入时不需要解析的目录，减少扫描量。
- `extensions`: 手动扩展别名解析的后缀，例如 `.vue`、`.mjs`。

### 常见问题

- **为什么 JSON 别名没有生效？** 请确认 `replacement` 是否为绝对路径，或检查别名是否与其他项目插件冲突。
- **能否为 WXS/WXML 配置别名？** 当前版本仅对 JSON 生效，JS/TS/WXML 的别名请继续使用 `tsconfig` + Vite 的 `resolve.alias`。

---

接下来，若你正在规划分包、Worker 或需要针对不同子包设置差异化构建策略，请前往 [分包与 Worker 策略](./subpackages-and-worker.md)。
