# 分包与 Worker 策略 {#subpackages-and-worker}

在大型小程序项目中，分包与 Worker 往往是性能和体积优化的关键。本节介绍如何通过 `weapp.subPackages` 精准控制分包行为，以及在启用 `app.json` Worker 时完成构建配置。

[[toc]]

## 理解编译上下文

- **普通分包**：与主包共享同一个 Rolldown 上下文，可复用公共 JS、样式、资源。
- **独立分包**：拥有独立上下文，无法直接访问主包和其他分包资源，适合异地部署或按需加载。

默认情况下，当 `app.json` 中的分包标记了 `independent: true`，`weapp-vite` 会自动为其创建独立构建上下文。若需要更细粒度的控制，请继续阅读下方配置。

## `weapp.subPackages` {#weapp-subpackages}
- **类型**：
  ```ts
  type StylesEntry = {
    source: string
    scope?: 'all' | 'pages' | 'components'
    include?: string | string[]
    exclude?: string | string[]
  }

  Record<string, {
    independent?: boolean
    dependencies?: (string | RegExp)[]
    inlineConfig?: Partial<InlineConfig>
    autoImportComponents?: AutoImportComponents
    styles?: string | StylesEntry | Array<string | StylesEntry>
  }>
  ```
- **键名**：分包在 `app.json` 中的 `root`。
- **适用场景**：
  - 强制将某个分包转为独立上下文（即使 `app.json` 中未标记）。
  - 为独立分包裁剪 `miniprogram_npm` 依赖。
  - 为某个分包注入额外的构建配置或自动导入策略。

### 完整示例

```ts
import { defineConfig } from 'weapp-vite/config'
import { VantResolver } from 'weapp-vite/auto-import-components/resolvers'

export default defineConfig({
  weapp: {
    subPackages: {
      packageA: {
        // 普通分包，但仍想开启自动导入组件
        autoImportComponents: {
          globs: ['src/packageA/components/**/*.wxml'],
        },
        styles: [
          'styles/common.wxss',
          {
            source: 'styles/pages.css',
            scope: 'pages', // 仅 pages/** 页面注入
          },
          {
            source: 'styles/components.css',
            scope: 'components', // 仅 components/** 组件注入
            include: [
              'components/**/index.*',
              'components/**/theme/**/*',
            ], // 精确控制要注入的组件样式
            exclude: ['components/legacy/**'],
          },
          {
            source: 'styles/forms.scss',
            include: [
              'forms/**/*.wxss',
              'forms/**/style.(scss|sass|css)',
            ], // 不使用 scope，仅依赖 include/exclude 控制
            exclude: ['forms/drafts/**'],
          },
        ],
      },
      packageB: {
        // 强制独立分包，并定制依赖列表
        independent: true,
        dependencies: ['buffer', /gm-crypto/],
        inlineConfig: {
          define: {
            'import.meta.env.PACKAGE_B': JSON.stringify(true),
          },
        },
        autoImportComponents: {
          resolvers: [VantResolver()],
        },
      },
    },
  },
})
```

#### 字段说明

- `independent`: 将分包编译为独立上下文，通常与微信后台“独立分包”配置保持一致。
- `dependencies`: 控制 `miniprogram_npm` 产物，避免未使用的依赖进入分包，减少包体积。
- `inlineConfig`: 针对该分包追加 Vite/Rolldown 配置（如 `define`、`plugins` 等）。
- `autoImportComponents`: 为分包单独开启/关闭自动组件导入，避免与主包策略冲突。
- `styles`: 指定一个或多个共享样式入口。构建时会将这些样式写入产物目录，并自动在该分包内生成的页面/组件样式中插入 `@import` 语句。相对路径默认基于分包 `root`，也可传入相对 `srcRoot` 的路径；支持 `.wxss`、`.css`、`.scss/.sass`（`sass-embedded` 或 `sass` 均可）、`.less`、`.styl/.stylus`、`.pcss/.postcss`、`.sss` 等常见格式，最终都会按目标平台样式后缀（如 `.wxss`）输出。支持对象写法来控制注入范围：
  - `scope`: `all`（默认）、`pages`、`components` 三挡快捷范围。
  - `include`/`exclude`: 追加精细化 glob 规则，默认以分包 `root` 为基准。
  - 当样式文件直接位于分包根目录且命名为 `index.*`、`pages.*`、`components.*` 时，会自动推导对应作用范围，无需手动填写 `scope`。

### 调试建议

1. 在 `npm.dependencies` 中仅保留必要 npm 包，再结合 `dependencies` 精准同步。
2. 使用 `weapp.debug.watchFiles` 记录输出，确认独立分包生成的 `miniprogram_npm` 是否符合预期。

## `weapp.chunks` {#weapp-chunks}
- **类型**：
  ```ts
  {
    sharedStrategy?: 'duplicate' | 'hoist'
    logOptimization?: boolean
  }
  ```
- **默认值**：`'duplicate'`
- **作用**：控制跨分包复用模块的产物位置。
  - `duplicate`：多分包复用的模块会被复制到各自分包的 `__shared__/common.js`。
  - `hoist`：多分包复用的模块会被提炼到主包下的 `common.js`，这是旧版本的行为。
- 在默认的 `duplicate` 策略下，`node_modules` 依赖与 `commonjsHelpers.js` 会随着引用方复制到各自分包；切换为 `hoist` 时，这些依赖会统一聚合到主包的 `common.js` 供所有分包共享。
- **logOptimization**：默认 `true`，会在控制台输出分包优化日志，例如共享模块被复制到哪些分包或由于主包引用而回退到主包。若需要静默输出目录，可设置为 `false` 关闭。

### 示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    chunks: {
      // 将跨分包共享模块回归到主包，兼容旧项目
      sharedStrategy: 'hoist',
    },
  },
})
```

若项目强调首次分包加载性能，推荐保留默认的 `duplicate` 策略，使每个分包持有自己的共享副本；若更关注整体包体积，则可以显式改为 `hoist`。

## `weapp.worker` {#weapp-worker}
- **类型**：`{ entry?: string | string[] }`
- **适用场景**：`app.json` 中启用了 Worker（`workers.path`），需要对 Worker 入口进行构建。

```ts
export default defineConfig({
  weapp: {
    worker: {
      entry: ['index', 'sync'],
    },
  },
})
```

- Worker 入口使用相对于 `srcRoot/workers` 目录的路径，省略扩展名。
- 若 `workers.path` 指向分包内部，请确保该分包也在 `subPackages` 中配置。

### Worker 调试技巧

- 结合 `weapp.debug.resolveId` 输出 Worker 依赖解析过程，快速定位模块找不到的问题。
- 若 Worker 使用 npm 包，可与 `dependencies` 配置共同使用，确保依赖被打包到正确目录。

---

继续了解 npm 构建与依赖策略，请前往 [npm 构建与依赖策略](./npm-and-deps.md)。
