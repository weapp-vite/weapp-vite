---
outline:
  - 2
  - 3
title: 共享 Chunk 策略（weapp.chunks）
description: weapp.chunks 用于控制 **复用模块的输出位置和形态**，常用于分包优化、避免不必要的 common.js、或减少重复体积。
keywords:
  - guide
  - chunks
  - 共享
  - chunk
  - 策略（weapp.chunks）
  - weapp.chunks
  - 用于控制
  - 复用模块的输出位置和形态
---

# 共享 Chunk 策略（weapp.chunks）

`weapp.chunks` 用于控制 **复用模块的输出位置和形态**，常用于分包优化、避免不必要的 `common.js`、或减少重复体积。

可以把它看作两层策略：

- **sharedStrategy**：共享模块“落在哪里”（主包 vs 分包）。
- **sharedMode**：共享模块“长什么样”（common.js / 按路径 / 内联）。

## 基础示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'common',
      dynamicImports: 'preserve',
      logOptimization: true,
    },
  },
})
```

## sharedStrategy：共享模块落盘策略

- `duplicate`（默认）：跨分包共享模块复制到各自分包，避免分包首开时回主包取依赖。
- `hoist`：共享模块统一提到主包，减少重复体积。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'hoist',
    },
  },
})
```

## sharedMode：共享模块输出形态

### 1) common（默认）

共享模块会汇总为 `common.js`，入口会自动改写引用该文件。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedMode: 'common',
    },
  },
})
```

### 2) path（按源码路径输出）

共享模块按源码相对路径输出，避免 `common.js`，同时保持路径稳定。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedMode: 'path',
      sharedPathRoot: 'src',
    },
  },
})
```

### 3) inline（禁用共享 chunk）

复用模块会被内联到引用方，完全不生成共享 chunk。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedMode: 'inline',
    },
  },
})
```

## sharedOverrides：针对模块覆盖输出形态

你可以为特定目录或模块设置不同的 `sharedMode`：

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedMode: 'common',
      sharedOverrides: [
        { test: 'components/**', mode: 'path' },
        { test: /legacy\//, mode: 'inline' },
      ],
    },
  },
})
```

- `test` 支持 glob 字符串或正则表达式
- 匹配基于 `srcRoot` 相对路径或绝对路径

## sharedPathRoot：路径型共享输出的根目录

当 `sharedMode = 'path'` 时，`sharedPathRoot` 用于计算输出路径的根目录（相对 `cwd`）。

- 未设置时默认使用 `srcRoot`
- 若设置的目录不在 `srcRoot` 内，构建会自动回退到 `srcRoot`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedMode: 'path',
      sharedPathRoot: 'src/shared',
    },
  },
})
```

## preserveModules：保留源码模块边界

如果你希望 `utils`、`services` 等目录中的模块始终以独立文件输出，可以使用 `preserveModules`：

```ts
export default defineConfig({
  weapp: {
    chunks: {
      preserveModules: ['utils/**', 'services/**'],
    },
  },
})
```

规则按 `srcRoot` 相对路径匹配。命中的模块会沿用源码目录输出，例如 `src/utils/request.ts` 对应 `utils/request.js`；页面不会再内联这些模块的实现，barrel 文件的静态依赖也会保留为独立边界。

这个选项主要服务于调试、源码定位和产物审计，不等同于体积优化。它可以和 `sharedStrategy`、`sharedMode` 一起配置；构建会自动处理与该拆分方式兼容的 entry signature。

### 案例：保留原生项目的 utils 和 services 目录

[issue #826](https://github.com/weapp-vite/weapp-vite/issues/826) 中的项目已经手动规划分包，并包含大量 `utils`、`services` 模块。默认 chunk 策略会把这些模块合并到共享 chunk，导致产物目录无法直接对应源码。此时可以按目录保留模块边界：

```text
src/
├─ pages/index/index.ts
├─ services/user.ts
└─ utils/request.ts
```

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    chunks: {
      preserveModules: [
        'utils/**',
        'services/**',
      ],
    },
  },
})
```

构建后，已进入模块依赖图的匹配文件会保留对应目录：

```text
dist/
├─ pages/index/index.js
├─ services/user.js
└─ utils/request.js
```

页面会引用 `utils/request.js` 和 `services/user.js`，而不是内联它们的实现。配置规则相对于 `srcRoot`，因此这里应写 `utils/**`，不要写 `src/utils/**`。`jsFormat: 'cjs'` 和 `jsFormat: 'esm'` 均支持该配置。

`preserveModules` 仍由构建器完成模块解析、TypeScript 转换和产物写入；它不会原样复制源码，也不会输出未被页面、组件或其他入口引用的文件。如果目标只是调整多个入口共享模块的输出位置，而不要求单次引用的模块也保持独立，应优先使用 `sharedMode: 'path'`。

## dynamicImports：动态 import 的处理方式

- `preserve`（默认）：保留独立的动态 chunk。
- `native`：仅在微信构建中，把跨入已声明普通分包的静态相对 `import()` 转为 `require.async()`。
- `inline`（已废弃）：当前回退为 `preserve` 并输出一次警告。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      dynamicImports: 'native',
    },
  },
})
```

`native` 会把目标路径规范化为实际 `.js` 产物路径，并让目标及其静态依赖留在目标分包。动态表达式、裸模块、同包导入、独立分包目标以及非微信平台仍保留 bundler 的动态导入语义。

## forceDuplicatePatterns：强制复制共享模块

当共享模块的直接导入方命中这些规则时，即使主包也引用该模块，仍会按 `duplicate` 策略复制到分包：

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      forceDuplicatePatterns: ['action/**', /services\//],
    },
  },
})
```

## duplicateWarningBytes：冗余体积告警

当共享模块复制后的冗余体积超过阈值时输出警告：

```ts
export default defineConfig({
  weapp: {
    chunks: {
      duplicateWarningBytes: 768 * 1024,
    },
  },
})
```

设置为 `0` 或 `undefined` 可关闭提醒。

## logOptimization：输出优化日志

启用后会在构建日志中输出共享模块的复制/回退信息，便于确认策略是否生效。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      logOptimization: true,
    },
  },
})
```

## 组合示例：禁用 common.js 并保持路径

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'path',
      sharedPathRoot: 'src',
      dynamicImports: 'preserve',
    },
  },
})
```

这样会避免生成 `common.js`，同时让共享模块保持与源码一致的相对路径。
