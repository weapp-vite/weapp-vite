# 基础目录与资源收集 {#paths-config}

本节聚焦于入口目录、插件目录、额外静态资源以及动态模板扫描等配置。通过这些选项，可以让项目结构更贴近团队习惯，同时确保构建器准确收集所有需要的文件。

[[toc]]

## `weapp.srcRoot` {#weapp-srcroot}
- **类型**：`string`
- **默认值**：`'.'`
- **适用场景**：`app.json` 不在仓库根目录，或者希望将源码集中放到 `src/`、`packages/miniprogram/` 等目录。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: './miniprogram',
  },
})
```

设置后，构建器会从该目录查找 `app.json`、入口 JS/TS、模板与静态资源，同步更新输出目录结构以及文件监听范围。

> [!TIP]
> 若你从 CLI 模板切换到 Monorepo 管理子包，可为每个子包单独设置 `srcRoot`，并结合 `weapp.subPackages` 控制输出结构。

## `weapp.pluginRoot` {#weapp-pluginroot}
- **类型**：`string`
- **默认值**：`undefined`
- **适用场景**：项目内同时维护小程序插件，需要打包 `plugin.json` 以及插件逻辑。

```ts
export default defineConfig({
  weapp: {
    srcRoot: '.',
    pluginRoot: './plugin',
  },
})
```

启用后，构建器会读取 `plugin.json`，将其中声明的页面与组件纳入扫描，确保插件部分与主包同步输出。更多细节参见 [插件开发指南](/guide/plugin)。

## `weapp.copy` {#weapp-copy}
- **类型**：`{ include?: string[]; exclude?: string[]; filter?: (filePath: string) => boolean }`
- **默认值**：`undefined`
- **适用场景**：需要额外拷贝第三方字体、证书、配置文件等静态资源到输出目录（区别于 `public/` 的原样复制）。

```ts
export default defineConfig({
  weapp: {
    copy: {
      include: ['**/*.ttf', '**/*.cer'],
      exclude: ['**/examples/**'],
      filter(filePath) {
        return !filePath.includes('README')
      },
    },
  },
})
```

- `include` / `exclude` 支持 [glob 模式](https://github.com/mrmlnc/fast-glob#pattern-syntax)，匹配范围基于 `srcRoot`。
- `filter` 会在匹配完成后再次执行，可用来剔除某些特殊文件。
- 如果资源已经放在 `public/`，无需使用 `copy`；weapp-vite 会自动原样复制。

## `weapp.isAdditionalWxml` {#weapp-isadditionalwxml}
- **类型**：`(wxmlPath: string) => boolean`
- **适用场景**：部分 WXML 并未在 `app.json` 中声明，但需要在运行时通过 `import` / `load` 的方式动态使用，例如运行时模板、富文本片段。

```ts
export default defineConfig({
  weapp: {
    isAdditionalWxml(wxmlPath) {
      return wxmlPath.endsWith('.fragment.wxml')
    },
  },
})
```

返回 `true` 的文件会被纳入构建图谱，自动处理依赖与输出。使用技巧可参考 [WXML 配置](/config/wxml.md)。

---

下一步：若你计划使用 CLI 自动生成页面/组件，请继续阅读 [生成脚手架配置](./generate.md)。
