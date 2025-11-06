# 共享配置 {#shared-config}

除了 WXML/WXS 这样的核心开关，`weapp-vite` 还提供了若干相互独立的增强能力，例如组件自动注册、调试钩子与约定式路由等。本节聚焦后两者，组件自动注册已拆分至 [自动导入组件配置](/config/auto-import-components.md) 独立章节。

[[toc]]

## `weapp.autoRoutes` {#weapp-autoroutes}
- **类型**：`boolean`
- **默认值**：`false`
- **适用场景**：
  - 希望从目录结构自动生成 `pages` 清单，避免手动维护 `app.json`。
  - 需要导出类型安全的路由对象，供脚本或模板直接引用。

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

- 持续扫描主包及分包下的页面目录，维护 `routes`、`entries`、`pages`、`subPackages` 等清单；
- 在配置文件同级输出 `typed-router.d.ts`，提供 `AutoRoutes` 等类型；
- 自动暴露虚拟模块 `weapp-vite/auto-routes`，支持在代码中直接导入最新的路由数据。

> [!WARNING]
> 自动路由遵循约定式目录结构：默认匹配 `pages/**/index` 或 `pages/**/main`。若项目使用自定义命名，请结合 `include`/`exclude` 规则进行扩展，详情见 [自动路由指南](/guide/auto-routes)。

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
- **适用场景**：排查文件变动、模块解析、加载顺序或产物生成问题。

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
- `resolveId`: 追踪模块解析路径，适合定位别名或分包间引用问题。
- `load`: 监听模块加载，常用于确认模板、脚本等是否经过预期的转换。
- `inspect`: 启用 [`vite-plugin-inspect`](https://github.com/antfu/vite-plugin-inspect)，在浏览器中观察插件顺序与产物。

### 常见调试技巧

1. **查看分包产物**：结合 `watchFiles` 输出，确认独立分包的 `miniprogram_npm` 是否生成。
2. **定位构建卡顿**：在 `resolveId` / `load` 中追加时间戳，快速识别耗时模块。
3. **调试自动导入**：若组件未被识别，可通过 `load` 钩子检查 `.json` 是否出现，或调整 `autoImportComponents.globs` 匹配范围。

## 关联阅读

- [WXML 配置](/config/wxml.md)：了解模板增强与组件扫描的协作方式。
- [WXS 配置](/config/wxs.md)：掌握脚本增强开关与调试方法。
- [npm 配置](/config/npm.md)：在调试过程中同时控制 npm 构建策略。
