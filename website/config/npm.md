---
title: npm 配置
description: weapp-vite 会把运行时依赖构建到小程序 npm 目录，并允许你按主包、插件、分包精细控制依赖落位、缓存与底层构建参数。
keywords:
  - 配置
  - config
  - npm
  - miniprogram_npm
  - subPackages
  - alipayNpmMode
---

# npm 配置 {#config-npm}

`weapp-vite` 内建了“小程序 npm 依赖落位”能力。它不仅仅是“把依赖打进 `miniprogram_npm`”，还允许你精细控制：

- 主包放哪些依赖
- 插件产物放哪些依赖
- 哪些依赖下沉到特定分包
- 单个 npm 包构建时用什么底层 Vite 配置

[[toc]]

## 默认依赖分类规则

默认情况下：

- `dependencies` 被视为运行时依赖
- `devDependencies` 被视为构建期依赖

也就是说：

- `dependencies` 中的包倾向于被保留为小程序 npm 依赖
- `devDependencies` 中的包倾向于被直接打进业务产物

## `weapp.npm` {#weapp-npm}

- **类型**：
  ```ts
  {
    enable?: boolean
    cache?: boolean
    mainPackage?: {
      dependencies?: false | (string | RegExp)[]
    }
    pluginPackage?: {
      dependencies?: false | (string | RegExp)[]
    }
    subPackages?: Record<string, {
      dependencies?: (string | RegExp)[]
    }>
    buildOptions?: (options: NpmBuildOptions, pkgMeta: BuildNpmPackageMeta) => NpmBuildOptions | undefined
    alipayNpmMode?: 'miniprogram_npm' | 'node_modules'
  }
  ```

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
      pluginPackage: {
        dependencies: ['dayjs'],
      },
      subPackages: {
        'packages/order': {
          dependencies: [/^tdesign-miniprogram/, 'dayjs'],
        },
      },
      buildOptions(options, { name }) {
        if (name === 'dayjs') {
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
      alipayNpmMode: 'node_modules',
    },
  },
})
```

## 字段说明

### `enable`

- **类型**：`boolean`

是否启用内建 npm 构建。

关闭后：

- `weapp-vite` 不再自动构建小程序 npm 目录
- 若源码里仍保留 `require('pkg')` / 包路径引用，则需要你自己处理，例如改为开发者工具手动构建 npm

### `cache`

- **类型**：`boolean`

是否启用 npm 构建缓存。

默认缓存目录：

- `node_modules/weapp-vite/.cache/`

适用建议：

- 日常开发保留 `true`
- 如果怀疑 npm 构建结果陈旧，再临时设 `false` 或手动清缓存

### `mainPackage.dependencies`

- **类型**：`false | (string | RegExp)[] | undefined`

控制主包里的 npm 依赖范围。

行为：

- `undefined`：默认按根 `dependencies` 处理
- `false`：不输出主包 npm 目录
- 数组：只输出命中的依赖

### `pluginPackage.dependencies`

- **类型**：`false | (string | RegExp)[] | undefined`

控制插件产物里的 npm 依赖范围。

仅在以下前提下有意义：

- 配置了 `weapp.pluginRoot`
- 当前走到了插件构建链路

### `subPackages`

- **类型**：`Record<string, { dependencies?: (string | RegExp)[] }>`

控制特定分包内的 npm 依赖落位。

适合：

- 把只在某个分包使用的依赖下沉到该分包
- 减少主包体积

### `buildOptions`

- **类型**：`(options, pkgMeta) => options | undefined`

允许你在“构建单个 npm 包”的那一层覆写底层 Vite 配置。

常见场景：

- 给个别依赖关闭压缩
- 给个别依赖开启 sourcemap
- 调整构建 target

> [!TIP]
> 这里操作的是“npm 包内部构建用的 Vite 配置对象”。若你需要理解其中 `build.*` 字段的完整语义，请直接看 [Vite 中文官方配置文档](https://cn.vite.dev/config/)。

### `alipayNpmMode`

- **类型**：`'miniprogram_npm' | 'node_modules'`

用于控制支付宝平台的本地 npm 输出目录风格。

默认是：

- `node_modules`

如果你的历史链路或团队约定需要走微信风格目录，可切到：

- `miniprogram_npm`

## 常见落位策略

### 主包尽量瘦身

```ts
export default defineConfig({
  weapp: {
    npm: {
      mainPackage: {
        dependencies: false,
      },
      subPackages: {
        'packages/order': {
          dependencies: ['dayjs'],
        },
      },
    },
  },
})
```

适合把明确只在分包用到的依赖下沉出去。

### 插件单独携带 npm

```ts
export default defineConfig({
  weapp: {
    srcRoot: 'miniprogram',
    pluginRoot: 'plugin',
    npm: {
      pluginPackage: {
        dependencies: ['dayjs'],
      },
      mainPackage: {
        dependencies: false,
      },
    },
  },
})
```

适合主应用和插件同仓维护，但只希望插件产物包含指定 npm 包。

## 与顶层 `build.*` 的边界

顶层 Vite `build.*` 影响的是主项目构建。

`weapp.npm.buildOptions` 影响的是：

- 小程序 npm 依赖包自己的内部构建

两者不要混淆。

更多原生字段请看：

- [Vite 中文官方配置文档 · build](https://cn.vite.dev/config/build-options)

## 常见问题

### npm 构建内容没更新

优先尝试：

1. 把 `cache` 设为 `false`
2. 清理 `node_modules/weapp-vite/.cache/`
3. 重新构建

### 分包体积过大

优先检查：

- `mainPackage.dependencies`
- `subPackages.<root>.dependencies`

### 支付宝平台目录不符合预期

优先检查：

- `weapp.platform`
- `weapp.npm.alipayNpmMode`

---

如果你继续处理分包边界，请回看 [分包配置](./subpackages.md)。如果你要处理库模式，则继续看 [库模式配置](./lib.md)。
