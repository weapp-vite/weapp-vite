# 基础目录与资源收集 {#paths-config}

这页主要解决 3 个问题：

1. **你的源码在哪**（`app.json`、`pages/`、`packages/` 在哪个目录）
2. **哪些文件要额外拷贝到 `dist/`**
3. **有哪些 WXML 虽然不是静态引用，但运行时需要用到**

[[toc]]

## `weapp.srcRoot` {#weapp-srcroot}
- **类型**：`string`
- **默认值**：`'.'`
- **适用场景**：`app.json` 不在仓库根目录，或你希望把源码统一放在 `src/`、`miniprogram/` 等目录。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: './miniprogram',
  },
})
```

设置后，weapp-vite 会从这个目录开始找 `app.json`、入口脚本、模板和静态资源，并同步调整输出结构与监听范围。

> [!TIP]
> 如果你在 monorepo 里维护多个小程序项目，可以给不同项目各自设置 `srcRoot`，再结合 `weapp.subPackages` 控制分包输出。

## `weapp.pluginRoot` {#weapp-pluginroot}
- **类型**：`string`
- **默认值**：`undefined`
- **适用场景**：项目里同时维护“小程序插件”，需要一起打包 `plugin.json` 和插件代码。

```ts
export default defineConfig({
  weapp: {
    srcRoot: '.',
    pluginRoot: './plugin',
  },
})
```

启用后，weapp-vite 会读取 `plugin.json`，把插件里声明的页面/组件也纳入扫描与输出。更多细节参见 [插件开发指南](/guide/plugin)。

## `weapp.copy` {#weapp-copy}
- **类型**：`{ include?: string[]; exclude?: string[]; filter?: (filePath: string) => boolean }`
- **默认值**：`undefined`
- **适用场景**：需要把字体/证书/配置文件等额外静态资源拷贝到输出目录（和 `public/` 的“整目录原样复制”是两条路）。

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
- 如果资源已经放在 `public/`，通常不需要再配 `copy`：weapp-vite 会原样复制到输出目录。

## `weapp.isAdditionalWxml` {#weapp-isadditionalwxml}
- **类型**：`(wxmlPath: string) => boolean`
- **适用场景**：有些 WXML 并不是静态 `import/include` 引用的，但运行时会用到（例如动态模板、富文本片段等），需要提前让构建器“知道它存在”。

```ts
export default defineConfig({
  weapp: {
    isAdditionalWxml(wxmlPath) {
      return wxmlPath.endsWith('.fragment.wxml')
    },
  },
})
```

返回 `true` 的文件会被纳入构建流程，相关依赖也会一起处理并输出到 `dist/`。更多用法可参考 [WXML 配置](/config/wxml.md)。

---

下一步：若你计划使用 CLI 自动生成页面/组件，请继续阅读 [生成脚手架配置](./generate.md)。
