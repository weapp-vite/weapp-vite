# 共享配置 {#shared-config}

除了 WXML/WXS 这些“底层开关”，`weapp-vite` 还有一些通用增强能力：比如自动路由、调试钩子等。这页主要讲：

- `weapp.autoRoutes`：不想手写 `app.json.pages` 时怎么做
- `weapp.debug`：遇到“为什么没扫描到 / 为什么没输出”时怎么定位

组件自动导入已经拆到 [自动导入组件配置](/config/auto-import-components.md) 单独说明。

[[toc]]

## `weapp.autoRoutes` {#weapp-autoroutes}
- **类型**：`boolean`
- **默认值**：`false`
- **适用场景**：
  - 希望从目录结构自动生成 `pages` 清单，不再手动维护 `app.json.pages`。
  - 希望在 TypeScript 里拿到“页面路径”的类型提示，避免字符串拼错。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoRoutes: true,
  },
})
```

开启后 weapp-vite 会：

- 持续扫描主包和分包下的页面目录，维护 `routes`、`entries`、`pages`、`subPackages` 等清单；
- 在配置文件同级输出 `typed-router.d.ts`，提供 `AutoRoutes` 等类型；
- 自动暴露虚拟模块 `weapp-vite/auto-routes`，支持在代码中直接导入最新的路由数据。

> [!WARNING]
> 自动路由依赖约定式目录结构：默认匹配 `pages/**/index` 或 `pages/**/main`。如果你的页面文件命名不同，请按需配置 `include` / `exclude`，详见 [自动路由指南](/guide/auto-routes)。

## `weapp.debug` {#weapp-debug}
- **类型**：
  ```ts
  {
    watchFiles?: (files: string[], meta?: SubPackageMetaValue) => void
    resolveId?: (id: string, meta?: SubPackageMetaValue) => void
    load?: (id: string, meta?: SubPackageMetaValue) => void
    inspect?: WrapPluginOptions
  }
  ```
- **适用场景**：排查“监听了哪些文件”“模块是怎么解析的”“某个文件有没有走到预期插件”“产物为什么没生成”等问题。

### 调试示例

```ts
export default defineConfig({
  weapp: {
    debug: {
      watchFiles(files, meta) {
        const scope = meta?.subPackage.root ?? 'main'
        console.info(`[watch:${scope}]`, files)
      },
      resolveId(id) {
        if (id.includes('lodash')) {
          console.log('[resolveId]', id)
        }
      },
      load(id) {
        if (id.endsWith('.wxml')) {
          console.log('[load wxml]', id)
        }
      },
      inspect: { build: true },
    },
  },
})
```

- `watchFiles`: 构建结束时返回监听到的文件，可区分主包与分包。
- `resolveId`: 追踪模块解析路径，适合定位别名、入口解析或分包引用问题。
- `load`: 监听模块加载，常用于确认模板、脚本等是否经过预期的转换。
- `inspect`: 启用 [`vite-plugin-inspect`](https://github.com/antfu/vite-plugin-inspect)，在浏览器中观察插件顺序与产物。

### 常见调试技巧

1. **确认分包有没有参与构建**：用 `watchFiles` 看看独立分包的 `miniprogram_npm` 是否生成、文件是否被监听到。
2. **定位构建卡顿**：在 `resolveId` / `load` 里打时间戳，快速找出慢的模块或目录。
3. **排查组件自动导入**：组件没被识别时，先确认 `.json` 是否包含 `component: true`，再看 `autoImportComponents.globs` 是否命中。

## 关联阅读

- [WXML 配置](/config/wxml.md)：了解模板增强与组件扫描的协作方式。
- [WXS 配置](/config/wxs.md)：掌握脚本增强开关与调试方法。
- [npm 配置](/config/npm.md)：在调试过程中同时控制 npm 构建策略。
