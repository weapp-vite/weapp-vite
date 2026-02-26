---
title: 分包配置
description: Weapp-vite 会读取 app.json.subPackages 来生成分包产物；weapp.subPackages 则用于
  **构建期补充配置**（独立分包、依赖裁剪、共享样式等）。
keywords:
  - 配置
  - 分包
  - config
  - subpackages
  - 分包配置
  - Weapp-vite
  - 会读取
---

# 分包配置 {#subpackages-config}

`weapp-vite` 会读取 `app.json.subPackages` 来生成分包产物；`weapp.subPackages` 则用于 **构建期补充配置**（独立分包、依赖裁剪、共享样式等）。

[[toc]]

## `weapp.subPackages` {#weapp-subpackages}
- **类型**：
  ```ts
  Record<string, {
    independent?: boolean
    dependencies?: (string | RegExp)[]
    inlineConfig?: Partial<InlineConfig>
    autoImportComponents?: AutoImportComponents | false
    watchSharedStyles?: boolean
    styles?: SubPackageStyleConfigEntry | SubPackageStyleConfigEntry[]
  }>
  ```
- **默认值**：`undefined`

示例：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    subPackages: {
      marketing: {
        independent: true,
        dependencies: [/^tdesign-miniprogram/],
        autoImportComponents: false,
        styles: [
          'styles/shared.wxss',
          { source: 'styles/pages.wxss', scope: 'pages' },
        ],
      },
    },
  },
})
```

### 字段说明

- `independent`：启用 **独立分包构建上下文**。常与 `app.json` 中的 `independent: true` 搭配使用。
- `dependencies`：**独立分包 npm 依赖裁剪**。用于从主包构建好的 `miniprogram_npm` 中筛选子集。
- `inlineConfig`：为该分包注入额外 Vite 配置（Rolldown/Rollup 插件、define 等）。
- `autoImportComponents`：为该分包单独配置/禁用自动导入。
- `watchSharedStyles`：分包文件变更时是否强制重新生成共享样式（默认 `true`）。
- `styles`：分包共享样式入口，详见下文。

> [!NOTE]
> `weapp.subPackages` 的 key 必须与 `app.json.subPackages[].root` 对应，否则不会生效。

## `subPackages.*.styles` {#subpackages-styles}

**类型**：`string | SubPackageStyleConfigObject | (string | SubPackageStyleConfigObject)[]`

`SubPackageStyleConfigObject` 结构：

```ts
{
  source: string
  scope?: 'all' | 'pages' | 'components'
  include?: string | string[]
  exclude?: string | string[]
}
```

说明：
- `source` 支持 **相对分包 root / 相对 srcRoot / 绝对路径**。
- `scope` 提供快捷范围：
  - `all`（默认）分包内所有页面/组件
  - `pages` 仅 `pages/**`
  - `components` 仅 `components/**`
- `include/exclude` 用于精确匹配（基于分包 root 的相对路径）。

---

更多分包实践与产物示例，请阅读 [分包指南](/guide/subpackage)。
