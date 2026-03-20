---
title: 共享 Chunk 配置
description: weapp.chunks 用于控制共享模块在主包、普通分包中的输出位置与输出形态。这是分包优化里最关键的一组配置。
keywords:
  - 配置
  - config
  - chunks
  - 共享 chunk
  - weapp.chunks
  - 分包优化
  - common.js
---

# 共享 Chunk 配置 {#chunks-config}

`weapp.chunks` 用于控制 **复用模块最终如何落盘**。

它主要解决三类问题：

- 跨分包复用的代码，到底要放到主包还是复制到各分包；
- 共享代码到底要输出成 `common.js`，还是保留更稳定的路径结构；
- 动态 `import()`、局部目录、历史模块，是否要使用不同的共享策略。

如果你在做分包体积优化、首开性能优化、`common.js` 治理，或者排查“为什么模块被提到主包了 / 为什么某个分包多出共享代码了”，优先看这页。

如果你想先理解运行时背景和整体产物分发模型，再看 [分包指南](/guide/subpackage) 与 [共享 Chunk 策略指南](/guide/chunks)。

[[toc]]

## `weapp.chunks` {#weapp-chunks}

- **类型**：
  ```ts
  {
    sharedStrategy?: 'duplicate' | 'hoist'
    sharedMode?: 'common' | 'path' | 'inline'
    sharedOverrides?: Array<{
      test: string | RegExp
      mode: 'common' | 'path' | 'inline'
    }>
    sharedPathRoot?: string
    dynamicImports?: 'preserve' | 'inline'
    logOptimization?: boolean
    forceDuplicatePatterns?: Array<string | RegExp>
    duplicateWarningBytes?: number
  }
  ```
- **默认值**：
  ```ts
  {
    sharedStrategy: 'duplicate',
    sharedMode: 'common',
    dynamicImports: 'preserve',
    logOptimization: true
  }
  ```

### 基础示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'common',
      dynamicImports: 'preserve',
      logOptimization: true,
      duplicateWarningBytes: 768 * 1024,
    },
  },
})
```

## 先记住这个判断模型

可以把 `weapp.chunks` 理解成两层：

- `sharedStrategy` 决定“共享模块放在哪”
- `sharedMode` 决定“共享模块长什么样”

也就是说：

- 你在纠结“主包 vs 分包”时，先看 `sharedStrategy`
- 你在纠结“common.js vs 保持路径 vs 不生成共享 chunk”时，先看 `sharedMode`

## `sharedStrategy`

- **类型**：`'duplicate' | 'hoist'`
- **默认值**：`'duplicate'`
- **作用**：决定跨普通分包共享模块，优先复制到各分包，还是统一提升到主包。

### `duplicate`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
    },
  },
})
```

含义：

- 某模块被多个普通分包复用时，优先复制到各自分包；
- 这样分包首开时更不依赖主包共享产物；
- 代价是可能带来重复体积。

适合：

- 分包首开性能优先；
- 业务域隔离较强，希望每个分包尽量自给自足；
- 你不希望某个公共依赖频繁被提升到主包。

### `hoist`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'hoist',
    },
  },
})
```

含义：

- 多个普通分包复用的模块会统一提升到主包；
- 这样总包体更容易去重；
- 代价是分包运行时更依赖主包里的共享代码。

适合：

- 包体去重优先；
- 共享依赖很多，复制后冗余明显；
- 团队更希望集中管理主包的公共产物。

### 怎么选

- 更看重首开体验：先用 `duplicate`
- 更看重总体积：先用 `hoist`
- 不确定时：先保留默认 `duplicate`，再结合 `duplicateWarningBytes` 和构建日志评估

> [!TIP]
> 这里说的“共享模块”主要指 **多个普通分包之间复用、且可被共享策略处理的模块**。独立分包不参与这套共享分发。

## `sharedMode`

- **类型**：`'common' | 'path' | 'inline'`
- **默认值**：`'common'`
- **作用**：决定共享模块最终的输出形态。

### `common`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedMode: 'common',
    },
  },
})
```

含义：

- 共享模块会汇总为 `common.js` 一类共享产物；
- 入口会自动改写引用，指向这些共享文件；
- 这是最容易理解、最接近传统小程序分包共享思路的模式。

适合：

- 团队希望共享逻辑直观可见；
- 你能接受 `common.js` 的存在；
- 你想用最稳妥、最通用的共享形态。

### `path`

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

含义：

- 共享模块按源码相对路径输出；
- 不再强制汇总为单一 `common.js`；
- 更适合希望产物路径稳定、可读、便于排查的项目。

适合：

- 你想弱化 `common.js`；
- 你希望共享模块产物能更容易对应回源码目录；
- 团队需要更稳定的构建输出路径做审计或比对。

### `inline`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedMode: 'inline',
    },
  },
})
```

含义：

- 共享模块会尽量内联到引用方；
- 不再额外生成共享 chunk；
- 适合极度强调“不要共享产物文件”的场景。

适合：

- 你明确不想要共享 chunk；
- 共享模块很小，但产物拆分过多；
- 某些历史项目对额外 chunk 路径较敏感。

> [!WARNING]
> `inline` 会减少共享产物文件，但通常会增加重复代码。它不是默认推荐解，只适合你明确知道自己在规避什么问题时使用。

## `sharedOverrides`

- **类型**：`Array<{ test: string | RegExp; mode: 'common' | 'path' | 'inline' }>`
- **默认值**：`undefined`
- **作用**：为特定模块或目录覆盖 `sharedMode`。

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

说明：

- `test` 支持 glob 字符串或正则；
- 匹配时会基于 `srcRoot` 相对路径或模块绝对路径判断；
- 适合“全局用一种模式，少数目录例外”的项目。

常见用途：

- 把公共组件目录改成 `path`，方便定位真实产物；
- 把历史兼容目录改成 `inline`，避免额外共享文件；
- 主体继续使用 `common`，只对局部做精细治理。

## `sharedPathRoot`

- **类型**：`string`
- **默认值**：未显式配置时使用 `srcRoot`
- **作用**：当 `sharedMode: 'path'` 时，用它来计算“按路径输出”的根目录。

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

建议：

- 希望产物更贴近源码结构时，通常设置为 `src` 或更具体的公共目录；
- 若配置的目录不在 `srcRoot` 内，构建会自动回退到 `srcRoot`。

## `dynamicImports`

- **类型**：`'preserve' | 'inline'`
- **默认值**：`'preserve'`
- **作用**：控制动态 `import()` 产物是否保留独立 chunk。

### `preserve`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      dynamicImports: 'preserve',
    },
  },
})
```

含义：

- 保留独立动态 chunk；
- 更符合按需加载的预期；
- 也是默认推荐值。

### `inline`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      dynamicImports: 'inline',
    },
  },
})
```

含义：

- 尽量减少动态 import 生成的额外 chunk；
- 适合想压缩 chunk 数量的项目；
- 但可能牺牲按需加载边界。

## `logOptimization`

- **类型**：`boolean`
- **默认值**：`true`
- **作用**：在构建日志中输出共享模块的复制、回退、提升等信息。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      logOptimization: true,
    },
  },
})
```

建议：

- 本地调优分包策略时保持开启；
- CI 如果日志噪声太大，再考虑关闭；
- 当你怀疑配置没生效时，先检查这里输出了什么。

## `forceDuplicatePatterns`

- **类型**：`Array<string | RegExp>`
- **默认值**：`undefined`
- **作用**：即使某些共享模块看起来被主包引用，只要其直接导入方命中规则，仍强制按 `duplicate` 方向复制到分包。

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

适合：

- 导入图中存在“伪主包引用”；
- 某些业务目录你明确希望它永远跟随分包走；
- 你想阻止这些模块被意外提升到主包。

## `duplicateWarningBytes`

- **类型**：`number`
- **默认值**：`0`
- **作用**：当 `duplicate` 带来的冗余体积超过阈值时给出警告。

```ts
export default defineConfig({
  weapp: {
    chunks: {
      duplicateWarningBytes: 768 * 1024,
    },
  },
})
```

建议：

- 团队开始治理分包冗余时，把它设成一个明确阈值；
- 小项目可以先不设；
- 设置为 `0` 或 `undefined` 可关闭提醒。

## 常见组合

### 组合 1：默认推荐基线

```ts
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

适合大多数普通分包项目，先保证共享逻辑稳定，再观察构建日志和体积。

### 组合 2：减少主包依赖，同时不想只看到 `common.js`

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'path',
      sharedPathRoot: 'src',
    },
  },
})
```

适合想保留分包自给自足，同时提升产物可读性的项目。

### 组合 3：总体积优先

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'hoist',
      sharedMode: 'common',
      duplicateWarningBytes: 512 * 1024,
    },
  },
})
```

适合共享依赖多、复制成本高的项目。

### 组合 4：主体稳定，局部定向治理

```ts
export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'common',
      sharedOverrides: [
        { test: 'components/**', mode: 'path' },
        { test: /legacy\//, mode: 'inline' },
      ],
    },
  },
})
```

适合已有存量项目渐进式优化，而不是一次性全局切换。

## 选型建议

- 先解决“共享模块落位”，再解决“共享模块形态”。
- 除非你明确要规避 `common.js`，否则优先从 `sharedMode: 'common'` 开始。
- 除非你明确更在意总体积，否则优先从 `sharedStrategy: 'duplicate'` 开始。
- 当团队开始争论“为什么这个模块进主包了”，先开 `logOptimization`，再考虑 `forceDuplicatePatterns`。
- 当项目越来越大时，把 `duplicateWarningBytes` 设成团队统一阈值，而不是纯靠人工观察。

## 常见误区

### 误区 1：只改 `sharedMode`，不看 `sharedStrategy`

`sharedMode` 决定的是“产物长什么样”，不是“产物放哪”。如果你想解决的是“为什么又回到主包了”，重点不在 `sharedMode`，而在 `sharedStrategy` 和真实导入图。

### 误区 2：把 `inline` 当成通用优化手段

`inline` 只是减少共享文件数量，不代表整体更优。很多时候它会增加重复体积，只适合有明确约束时使用。

### 误区 3：忽略独立分包的隔离语义

`weapp.chunks` 主要面向主包和普通分包之间的共享治理。独立分包是独立构建上下文，不要期待它复用普通分包的共享产物。

## 关联阅读

- [共享 Chunk 策略指南](/guide/chunks)
- [分包指南](/guide/subpackage)
- [分包配置](/config/subpackages.md)
- [库模式配置](/config/lib.md)
