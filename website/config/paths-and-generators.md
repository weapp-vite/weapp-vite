# 基础目录与脚手架 {#paths-and-generators}

本节聚焦于入口目录、插件目录、额外静态资源以及 `weapp-vite generate` 相关的配置。通过这些选项，可以让项目结构更贴近团队习惯，同时在创建页面/组件时保持一致的产物格式。

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

> **提示**：若你从 CLI 模板切换到 Monorepo 管理子包，可以将 `srcRoot` 指向子应用所在目录，并结合 `subPackages` 控制输出结构。

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

启用后，构建器会读取 `plugin.json`，将其中声明的页面与组件纳入扫描，确保插件部分与主包同步输出。

## `weapp.copy` {#weapp-copy}
- **类型**：`{ include?: string[]; exclude?: string[]; filter?: (filePath: string) => boolean }`
- **适用场景**：需要额外拷贝第三方字体、证书、配置文件等静态资源到输出目录。

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

- `include` / `exclude` 支持 [glob 模式](https://github.com/mrmlnc/fast-glob#pattern-syntax)。
- `filter` 在匹配完成后再次执行，可用来剔除某些特殊文件。

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

返回 `true` 的文件会被纳入构建图谱，自动处理依赖与输出。

## `weapp.generate` {#weapp-generate}
- **类型**：
  ```ts
  {
    extensions?: Partial<{ js: string; json: string; wxml: string; wxss: string }>
    dirs?: Partial<{ app: string; page: string; component: string }>
    filenames?: Partial<{ app: string; page: string; component: string }>
  }
  ```
- **适用场景**：使用 `weapp-vite generate` 命令自动创建页面/组件时，统一约定目录结构和文件后缀。

```ts
export default defineConfig({
  weapp: {
    generate: {
      extensions: {
        js: 'ts',
        json: 'jsonc',
        wxss: 'scss',
      },
      dirs: {
        page: 'src/pages',
        component: 'src/components',
      },
      filenames: {
        app: 'app',
        page: 'index',
      },
    },
  },
})
```

### 常见问题

- **CLI 会覆盖我的自定义目录吗？** 不会，`generate` 只影响命令生成的新文件，不会改动已有文件结构。
- **如何生成多语言模板？** 可以通过 `extensions.json` 设置为 `jsonc`，配合 JSONC 支持添加注释或多语言占位符。

---

下一步：若需要在 JSON 配置中使用别名或共享组件路径，请继续阅读 [JSON 别名与路径解析](./json-and-alias.md)。
