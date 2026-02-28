---
title: npm 配置
description: Weapp-vite 会自动把 **dependencies** 里的依赖构建成 miniprogram_npm/，而把
  **devDependencies** 视为“仅构建期依赖”，直接内联进产物。
keywords:
  - 配置
  - config
  - npm
  - Weapp-vite
  - 会自动把
  - dependencies
  - 里的依赖构建成
---

# npm 配置 {#config-npm}

`weapp-vite` 会自动把 **dependencies** 里的依赖构建成 `miniprogram_npm/`，而把 **devDependencies** 视为“仅构建期依赖”，直接内联进产物。

[[toc]]

## 依赖分类规则（默认）

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

- 引入 `lodash` ⇒ 产物保留 `require('lodash')`，并生成 `miniprogram_npm/lodash`。
- 引入 `lodash-es` ⇒ 相关实现会被打包并内联到页面/组件脚本。

> [!TIP]
> 建议团队统一约定：**运行时依赖放 `dependencies`**，构建期依赖放 `devDependencies`。

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
            },
          }
        }
        return options
      },
    },
  },
})
```

字段说明：
- `enable`：关闭后 **不会自动构建** `miniprogram_npm`。如果你的代码仍保留 `require('pkg')`，需要自行处理（如 devtools 构建 npm）。
- `cache`：是否启用 npm 构建缓存（缓存目录：`node_modules/weapp-vite/.cache/`）。
- `buildOptions`：为单个包覆写 Vite 库模式构建参数。

## 控制 npm 依赖的压缩与 sourcemap

`weapp.npm` 内部依赖构建默认是：

- `minify: true`
- `sourcemap: false`

如果你希望 `miniprogram_npm` 里的某些包不压缩并生成 sourcemap，可以在 `buildOptions` 中覆写：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    npm: {
      buildOptions(options, { name }) {
        if (name === 'lodash') {
          return {
            ...options,
            build: {
              ...options.build,
              minify: false,
              sourcemap: true,
            },
          }
        }
        return options
      },
    },
  },
})
```

> [!NOTE]
> `build.minify/build.sourcemap` 只影响你的主项目产物；  
> `weapp.npm.buildOptions` 用于控制 `miniprogram_npm` 依赖包的构建行为。

## 手动构建命令

如需在命令行触发开发者工具的 npm 构建：

```json
{
  "scripts": {
    "build:npm": "weapp-vite build:npm",
    "npm": "weapp-vite npm"
  }
}
```

> [!NOTE]
> 该命令依赖 **weapp-ide-cli**，请确保微信开发者工具已开启“服务端口”。

## 常见问题

- **npm 构建内容未更新**：尝试将 `cache` 设为 `false`，或清理 `node_modules/weapp-vite/.cache/`。
- **分包体积过大**：结合 `weapp.subPackages.*.dependencies` 裁剪独立分包依赖。

---

下一步：需要分包能力？请前往 [分包配置](./subpackages.md)。
