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
    mainPackage?: {
      dependencies?: false | (string | RegExp)[]
    }
    subPackages?: Record<string, {
      dependencies?: (string | RegExp)[]
    }>
    buildOptions?: (options: NpmBuildOptions, meta: { name: string; entry: InputOption }) => NpmBuildOptions | undefined
    alipayNpmMode?: 'node_modules' | 'miniprogram_npm'
  }
  ```
- **默认值**：`{ enable: true, cache: true, alipayNpmMode: 'node_modules' }`

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    npm: {
      enable: true,
      cache: true,
      mainPackage: {
        dependencies: false,
      },
      subPackages: {
        'packages/order': {
          dependencies: [/^tdesign-miniprogram/],
        },
      },
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
- `mainPackage.dependencies`：
  - `undefined`：默认行为，按根 `package.json.dependencies` 输出到主包；
  - `false`：禁止输出主包 `miniprogram_npm`；
  - `string[] | RegExp[]`：只把命中的依赖输出到主包。
- `subPackages`：为特定分包声明本地 npm 依赖范围。命中的分包会输出自己的 `miniprogram_npm`，并将分包内命中的 npm 引用重写到本地目录。
- `buildOptions`：为单个包覆写 Vite 库模式构建参数。
- `alipayNpmMode`：支付宝平台 npm 目录风格。默认 `node_modules`，若要兼容微信风格目录，可切到 `miniprogram_npm`。

## 主包 / 分包依赖落位

默认情况下，`weapp-vite` 会把根 `package.json.dependencies` 视为运行时依赖，输出到主包 `miniprogram_npm`。

如果你希望把依赖尽量下沉到独立分包，可以这样做：

```ts
export default defineConfig({
  weapp: {
    npm: {
      mainPackage: {
        dependencies: false,
      },
      subPackages: {
        'packages/order': {
          dependencies: [/^tdesign-miniprogram/, 'dayjs'],
        },
        'packages/member': {
          dependencies: ['@scope/member-sdk'],
        },
      },
    },
  },
})
```

适用场景：
- 想把只被独立分包使用的依赖留在分包内，减少主包体积。
- 想精确控制不同分包的 `miniprogram_npm` 内容。

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
- **分包体积过大**：使用 `weapp.npm.mainPackage.dependencies` 和 `weapp.npm.subPackages.<root>.dependencies` 精确控制依赖落位。
- **支付宝平台下 npm 目录不符合预期**：检查 `weapp.npm.alipayNpmMode`，默认是 `node_modules` 而不是 `miniprogram_npm`。

---

下一步：需要分包能力？请前往 [分包配置](./subpackages.md)。
