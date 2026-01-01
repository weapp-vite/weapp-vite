# npm 配置 {#config-npm}

`weapp-vite` 会帮你处理“npm 依赖怎么进小程序”：

- 一部分依赖会被构建到 `miniprogram_npm/`（产物里保留 `require('xxx')`）
- 另一部分会被直接内联进页面/组件脚本（不额外生成 npm 目录）

这页说明默认规则，以及如何用 `weapp.npm` 做少量定制。

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

- 引入 `lodash` ⇒ 产物会保留 `require('lodash')`，并生成 `miniprogram_npm/lodash`。
- 引入 `lodash-es` ⇒ 相关实现会被打包并内联到页面/组件脚本里。

建议团队统一约定：**运行时要用的库放 `dependencies`，只在开发/构建期用的放 `devDependencies`**，这样 weapp-vite 更容易按预期工作。

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
  - 不想自动生成 `miniprogram_npm`（交给你自己处理，或只想内联）。
  - 某个 npm 包构建有特殊需求，需要覆写它的构建参数。
  - 调试构建异常时，想临时关闭缓存。

### 配置示例

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
            build: {
              ...options.build,
              target: 'es2018',
              rollupOptions: {
                ...options.build?.rollupOptions,
                treeshake: true,
              },
            },
          }
        }

        if (name === 'dayjs') {
          const external = options.build?.rollupOptions?.external ?? []
          return {
            ...options,
            build: {
              ...options.build,
              rollupOptions: {
                ...options.build?.rollupOptions,
                external: [...external, 'dayjs/plugin/advancedFormat'],
              },
            },
          }
        }

        return options
      },
    },
  },
})
```

### 字段详解

- `enable`: 全局开关。关闭后不会生成 `miniprogram_npm`（但“内联”仍然会发生）。
- `cache`: 是否启用 npm 构建缓存。遇到“改了却没生效”时可以临时关掉。
- `buildOptions`: 针对某个包覆写 Vite 库模式的 `build` / `rollupOptions` 等参数；第二个参数里有 `name`（包名）与 `entry`（入口）。

> [!TIP]
> `buildOptions` 的第二个参数包含 `name`（包名）与 `entry`，可以用来为不同 npm 包应用特定的 Vite 构建选项，例如开启 tree-shaking、调整目标版本或声明外部依赖。

## 手动构建命令

如果你想在命令行复现「开发者工具 → 工具 → 构建 npm」，可以在 `package.json` 里加脚本：

```json
{
  "scripts": {
    "build:npm": "weapp-vite build:npm",
    "npm": "weapp-vite npm"
  }
}
```

随后运行 `pnpm run build:npm`（或 `pnpm run npm`），即可与微信开发者工具保持一致，方便在 CI/CD 中复用。

## 常见问题排查

| 现象 | 建议排查顺序 |
| --- | --- |
| `miniprogram_npm` 体积过大 | 使用 `dependencies` 精确列出主包依赖，并在 `subPackages.*.dependencies` 中裁剪独立分包依赖 |
| npm 构建内容未更新 | 尝试将 `cache` 设为 `false` 或删除 `node_modules/.cache/weapp-vite` 目录 |
| 某 npm 包构建失败 | 在 `buildOptions` 中为该包设置 `external` / `format`，或改为自动内联 |

---

若你需要在模板/脚本侧继续扩展能力，请前往 [共享配置](/config/shared.md) 查看自动导入组件、调试钩子与自动路由的使用方式，或阅读 [WXML 配置](/config/wxml.md) 与 [WXS 配置](/config/wxs.md) 进一步定制构建体验。
