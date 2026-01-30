# 基础目录与资源收集 {#paths-config}

本页涵盖：

1. **源码根目录**（`app.json` 在哪）
2. **插件根目录**（是否同时构建小程序插件）
3. **静态资源收集与复制**（哪些文件会被搬进 `dist/`）
4. **额外 WXML**（可选，当前版本为预留字段）

[[toc]]

## `weapp.srcRoot` {#weapp-srcroot}
- **类型**：`string`
- **默认值**：项目根目录（`''` 等价于 `.`）
- **适用场景**：`app.json` 不在仓库根目录，或你希望把源码统一放在 `src/`、`miniprogram/` 等目录。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: './miniprogram',
  },
})
```

说明：
- `srcRoot` 会影响 **扫描入口**、**产物路径**、**资源复制** 与 **自动路由** 等行为。
- 构建时会从该目录寻找 `app.json`，找不到会直接报错。

## `weapp.pluginRoot` {#weapp-pluginroot}
- **类型**：`string`
- **默认值**：`undefined`
- **适用场景**：项目中同时维护“小程序插件”，需要一起打包 `plugin.json` 与插件代码。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: '.',
    pluginRoot: './plugin',
  },
})
```

说明：
- `pluginRoot` 指向 `plugin.json` 所在目录。
- 插件产物输出路径会根据 `project.config.json` 的 `pluginRoot`（若有）或构建输出目录自动推导。
- 插件构建与主应用构建复用同一套 alias/TS/依赖处理能力。

## `weapp.copy` {#weapp-copy}
- **类型**：`{ include?: string[]; exclude?: string[]; filter?: (filePath: string) => boolean }`
- **默认值**：`undefined`
- **适用场景**：把字体/证书/自定义数据等 **非代码资源** 复制到 `dist/`。

```ts
import { defineConfig } from 'weapp-vite/config'

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

行为说明：
- 默认会收集常见静态资源后缀（如 `png/jpg/svg/mp3/mp4/wasm`），并排除 `node_modules`、`miniprogram_npm`、`.wevu-config` 等目录。
- `include` / `exclude` 是 glob 列表，匹配范围基于 `srcRoot`（主应用）或 `pluginRoot`（插件构建）。
- `filter` 会在 glob 命中后再次过滤。

> [!TIP]
> Vite 的 `public/` 目录仍会被原样复制。如果资源已经放在 `public/`，通常不需要再配置 `weapp.copy`。

## `weapp.isAdditionalWxml` {#weapp-isadditionalwxml}
- **类型**：`(wxmlFilePath: string) => boolean`
- **默认值**：`() => false`
- **状态**：**当前版本为预留字段**（尚未接入扫描/产物流程）。

如果你的项目依赖“运行时动态拼接 WXML 路径”，建议 **改用显式文件引用** 或在构建阶段自行补充产物；该字段目前不会影响构建图谱。

---

下一步：需要构建输出与兼容策略？请前往 [构建输出与兼容](./build-and-output.md)。
