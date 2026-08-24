---
title: 分包配置
description: weapp-vite 支持主包共享样式入口，并会读取 app.json.subPackages 生成分包产物；weapp.subPackages 则提供独立分包、分包级内联配置、自动导入覆盖与共享样式等增强能力。
keywords:
  - 配置
  - config
  - subpackages
  - 分包配置
  - independent
  - styles
---

# 分包配置 {#subpackages-config}

`weapp.styles` 负责主包与普通分包可复用的共享样式入口；`app.json.subPackages` 决定“小程序有哪些分包”，而 `weapp.subPackages` 决定“这些分包在构建阶段还需要哪些额外能力”。

这些配置要一起看：

- `app.json.subPackages`：声明分包本身
- `weapp.subPackages`：补充构建期增强

[[toc]]

## `weapp.styles` {#weapp-styles}

- **类型**：`StyleConfigEntry | StyleConfigEntry[]`
- **默认值**：`undefined`

用于把主包源码目录中的样式编译为独立产物，并按规则向主包与普通分包的样式注入相对 `@import`。默认不会修改 `app.wxss`；`include` 显式匹配 `app.vue` 等应用入口时，可以向 `app.wxss` 注入。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    styles: [
      {
        source: 'styles/theme.scss',
        include: ['pages/**', 'components/**', 'packages/*/**'],
      },
      {
        source: 'styles/manual.less',
        inject: false,
      },
      {
        source: 'styles/app-theme.scss',
        include: 'app.vue',
      },
    ],
  },
})
```

构建后会生成 `styles/theme.wxss` 和 `styles/manual.wxss`：

- `theme.wxss` 会被命中的主包、普通分包页面或组件引用。
- `manual.wxss` 只生成文件，供源码使用 `@wv-keep-import` 或其他原生方式手动引用。
- 未显式配置 `include` 时，app 默认被排除，避免共享样式意外变成全局样式。
- `include: 'app.vue'` 会让生成的 `app.wxss` 引用对应共享样式资产。
- 独立分包不能依赖主包资源，因此不会注入这些入口。需要在独立分包使用同一主题时，应在对应的 `weapp.subPackages.<root>.styles` 中显式声明一份分包内入口。

> [!NOTE]
> `weapp.styles` 的 `include` / `exclude` 相对 `srcRoot` 匹配。`scope: 'pages'` 和 `scope: 'components'` 的默认规则分别是根级 `pages/**` 与 `components/**`；要覆盖分包目录或 app，请使用显式 glob。

## `weapp.subPackages` {#weapp-subpackages}

- **类型**：
  ```ts
  Record<string, {
    independent?: boolean
    inlineConfig?: Partial<InlineConfig>
    autoImportComponents?: AutoImportComponents | boolean
    watchSharedStyles?: boolean
    styles?: StyleConfigEntry | StyleConfigEntry[]
  }>
  ```
- **默认值**：`undefined`

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    subPackages: {
      marketing: {
        independent: true,
        autoImportComponents: false,
        styles: [
          'styles/shared.wxss',
          {
            source: 'styles/pages.wxss',
            scope: 'pages',
          },
        ],
      },
    },
  },
})
```

> [!NOTE]
> 这里的 key 必须与 `app.json.subPackages[].root` 一致，否则不会生效。

## 字段说明

### `independent`

- **类型**：`boolean`

表示该分包是否按独立分包上下文处理。

它通常应和 `app.json` 中对应分包的 `independent: true` 保持一致，避免配置语义分裂。

### `inlineConfig`

- **类型**：`Partial<InlineConfig>`

允许为单个分包追加 Vite 内联配置。

适用场景：

- 某个分包需要额外 `define`
- 某个分包要临时增加插件或局部构建参数

> [!TIP]
> `inlineConfig` 里写的是 **Vite 原生配置**。字段本身的语义请直接看 [Vite 中文官方配置文档](https://cn.vite.dev/config/)。

### `autoImportComponents`

- **类型**：`AutoImportComponents | boolean`

用于给单个分包覆盖全局组件自动导入策略，或直接关闭它。

常见场景：

- 某个分包不希望自动补 `usingComponents`
- 某个分包需要额外的 resolver 或组件扫描规则

### `watchSharedStyles`

- **类型**：`boolean`

控制该分包在开发时是否监听共享样式并触发重新生成。

适合：

- 分包共享样式很多，且你明确想控制 dev 监听成本

### `styles`

- **类型**：`StyleConfigEntry | StyleConfigEntry[]`

用于声明分包共享样式入口。

## `subPackages.*.styles` {#subpackages-styles}

`StyleConfigEntry` 支持两种形式：

- 字符串
- 对象

对象结构为：

```ts
{
  source: string
  scope?: 'all' | 'pages' | 'components'
  include?: string | string[]
  exclude?: string | string[]
  inject?: boolean
}
```

示例：

```ts
export default defineConfig({
  weapp: {
    subPackages: {
      marketing: {
        styles: [
          'styles/shared.wxss',
          {
            source: 'styles/page-only.wxss',
            scope: 'pages',
            exclude: ['pages/legacy/**'],
          },
        ],
      },
    },
  },
})
```

字段说明：

- `source`：样式源文件路径，可相对分包 root、相对 `srcRoot`，也可直接用绝对路径
- `scope`：
  - `all`：分包内所有页面和组件
  - `pages`：只作用于页面
  - `components`：只作用于组件
- `include` / `exclude`：更精细的 glob 匹配
- `inject`：默认 `true`；设为 `false` 时只生成独立样式文件，不自动插入 `@import`

## 与自动路由的关系

当启用 `weapp.autoRoutes` 时，`weapp.subPackages` 还有一个额外作用：

- 告诉自动路由“哪些 root 应按分包页面目录处理”

如果你的分包页面不走默认 `root/pages/**` 约定，通常需要同时配置：

- `weapp.subPackages`
- `weapp.autoRoutes.include`

## 与 npm 分包落位的关系

`weapp.subPackages` 不负责 npm 包落位。

如果你要控制：

- 哪些依赖进入主包 `miniprogram_npm`
- 哪些依赖进入指定分包 `miniprogram_npm`

请使用：

- `weapp.npm.mainPackage`
- `weapp.npm.subPackages`

详见 [npm 配置](./npm.md)。

## 常见建议

### 什么时候要用 `inlineConfig`

只有当某个分包真的需要“局部构建差异”时再用。大多数分包项目先保持全局统一配置更稳。

### 什么时候要把样式抽到 `styles`

当一套共享样式要稳定作用于整个分包，而不是单个组件手动导入时，这个字段价值最高。

### 独立分包为什么还要单独关注共享 chunk

因为独立分包不参与普通分包那套共享分发模型。做分包优化时，要一起看：

- [共享 Chunk 配置](./chunks.md)
- [npm 配置](./npm.md)

---

如果你接下来要继续处理分包依赖落位，请看 [npm 配置](./npm.md)。如果你要继续处理共享模块落盘策略，请看 [共享 Chunk 配置](./chunks.md)。
