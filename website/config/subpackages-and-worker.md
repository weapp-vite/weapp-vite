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
  Record<string, {
    independent?: boolean
    dependencies?: (string | RegExp)[]
    inlineConfig?: Partial<InlineConfig>
    autoImportComponents?: AutoImportComponents
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

### 调试建议

1. 在 `npm.dependencies` 中仅保留必要 npm 包，再结合 `dependencies` 精准同步。
2. 使用 `weapp.debug.watchFiles` 记录输出，确认独立分包生成的 `miniprogram_npm` 是否符合预期。

## `weapp.chunks` {#weapp-chunks}
- **类型**：
  ```ts
  {
    sharedStrategy?: 'duplicate' | 'hoist'
  }
  ```
- **默认值**：`'duplicate'`
- **作用**：控制跨分包复用模块的产物位置。
  - `duplicate`：多分包复用的模块会被复制到各自分包的 `__shared__/common.js`。
  - `hoist`：多分包复用的模块会被提炼到主包下的 `common.js`，这是旧版本的行为。

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
