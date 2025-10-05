# npm 构建与依赖策略 {#npm-and-deps}

`weapp-vite` 将 npm 依赖拆分成“自动构建”和“自动内联”两种策略：

- **自动构建**：`package.json` 中 `dependencies` 的包会被编译到 `miniprogram_npm`。
- **自动内联**：未列在 `dependencies` 中的包会被直接打入对应 JS 产物。

本节介绍如何通过 `weapp.npm` 做更细致的控制，并提供手动构建命令、缓存等常见问题的解法。

[[toc]]

## 自动与内联的区别

```jsonc
{
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "lodash-es": "^4.17.21"
  }
}
```

- 引入 `lodash` ⇒ 产物会 `require('lodash')`，对应代码写入 `miniprogram_npm/lodash`。
- 引入 `lodash-es` ⇒ 相关实现代码会直接被内联到页面 JS，避免额外包体。

## `weapp.npm` {#weapp-npm}
- **类型**：
  ```ts
  {
    enable?: boolean
    cache?: boolean
    buildOptions?: (options: NpmBuildOptions, meta: { name: string; entry: InputOption }) => NpmBuildOptions | undefined
  }
  ```
- **默认值**：`{ enable: true, cache: true }`
- **适用场景**：
  - 部分项目不希望自动构建 `miniprogram_npm`。
  - 需要为特定包覆盖 tsdown 编译配置。
  - 构建过程中需要关闭缓存以排查问题。

### 精细化示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    npm: {
      enable: true,
      cache: true,
      buildOptions(options, { name }) {
        if (name === 'lodash') {
          return {
            ...options,
            treeshake: true,
            target: 'es2018',
          }
        }

        if (name === 'dayjs') {
          return {
            ...options,
            external: ['dayjs/plugin/advancedFormat'],
          }
        }

        return options
      },
    },
  },
})
```

#### 字段详解

- `enable`: 全局开关，关闭后不会生成 `miniprogram_npm`（但仍支持自动内联）。
- `cache`: 控制 tsdown 缓存，推荐在调试或 CI 失败时临时关闭。
- `buildOptions`: 灵活覆写 tsdown 的 `format`、`target`、`external` 等选项，`meta` 中包含包名与入口。

## 手动构建命令

当需要与微信开发者工具保持一致时，可执行：

```bash
pnpm weapp-vite npm
```

该命令等价于在开发者工具中点击“工具 → 构建 npm”，适合与 CI/CD 管道集成。

## 常见问题排查

| 现象 | 建议排查顺序 |
| --- | --- |
| `miniprogram_npm` 体积过大 | 使用 `dependencies` 精确列出主包依赖，并在 `subPackages.*.dependencies` 中裁剪独立分包依赖 |
| npm 构建内容未更新 | 尝试将 `cache` 设为 `false` 或删除 `node_modules/.cache/weapp-vite` 目录 |
| 某 npm 包构建失败 | 在 `buildOptions` 中对该包设置 `external` / `format`，或将其改为自动内联 |

---

接下来，若你计划启用自动导入组件、WXML/WXS 增强或调试构建流程，请继续阅读 [增强能力与调试工具](./enhance-and-debug.md)。
