# npm 配置 {#config-npm}

`weapp-vite` 将 npm 依赖拆分成“自动构建”（写入 `miniprogram_npm`）与“自动内联”两种策略，通过顶层的 `weapp.npm` 配置即可精细控制构建行为。本节说明默认策略、常用字段以及手动命令。

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
- 引入 `lodash-es` ⇒ 相关实现代码直接被内联到页面 JS，避免额外包体。

为了调试方便，建议团队约定：“凡运行时代码需要的依赖放在 `dependencies`，开发工具链或构建脚本使用的放在 `devDependencies`”，让 weapp-vite 自动做出正确判断。

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
  - 需要针对特定包覆写 tsdown 编译配置。
  - 调试构建问题时希望临时关闭缓存。

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

### 字段详解

- `enable`: 全局开关，关闭后不会生成 `miniprogram_npm`（但仍支持自动内联）。
- `cache`: 控制 tsdown 缓存，推荐在定位构建异常时临时关闭。
- `buildOptions`: 覆写 tsdown 的 `format`、`target`、`external` 等选项，`meta` 中包含包名与入口，可用于针对不同依赖定制策略。

> [!TIP]
> `buildOptions` 的第二个参数包含 `name`（包名）与 `entry`，可以用来为不同 npm 包应用特定的 tsdown 选项，例如开启 tree-shaking、调整目标版本或声明外部依赖。

## 手动构建命令

当需要与微信开发者工具保持一致时，可执行：

```bash
pnpm weapp-vite npm
```

或使用别名：

```bash
pnpm weapp-vite build:npm
```

建议在 `package.json` 中添加脚本，方便团队统一使用：

```json
{
  "scripts": {
    "build:npm": "weapp-vite build:npm"
  }
}
```

该命令等价于在开发者工具中点击“工具 → 构建 npm”，适合与 CI/CD 流程配合使用。

## 常见问题排查

| 现象 | 建议排查顺序 |
| --- | --- |
| `miniprogram_npm` 体积过大 | 使用 `dependencies` 精确列出主包依赖，并在 `subPackages.*.dependencies` 中裁剪独立分包依赖 |
| npm 构建内容未更新 | 尝试将 `cache` 设为 `false` 或删除 `node_modules/.cache/weapp-vite` 目录 |
| 某 npm 包构建失败 | 在 `buildOptions` 中为该包设置 `external` / `format`，或改为自动内联 |

---

若你需要在模板/脚本侧继续扩展能力，请前往 [共享配置](/config/shared.md) 查看自动导入组件、调试钩子与自动路由的使用方式，或阅读 [WXML 配置](/config/wxml.md) 与 [WXS 配置](/config/wxs.md) 进一步定制构建体验。
