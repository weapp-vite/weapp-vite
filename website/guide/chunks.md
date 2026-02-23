---
outline: [2, 3]
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

## dynamicImports：动态 import 的处理方式

- `preserve`（默认）：保留独立的动态 chunk。
- `inline`：尽量内联动态 import，减少额外 chunk。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      dynamicImports: 'inline',
    },
  },
})
```

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
