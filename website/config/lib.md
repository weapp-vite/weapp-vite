---
title: 库模式配置
description: weapp-vite 的 lib 模式用于构建小程序组件库或业务模块库，支持多入口、路径保持、组件 JSON 生成与 DTS 输出。
keywords:
  - 配置
  - config
  - lib
  - 库模式
  - dts
  - componentJson
---

# 库模式配置 {#lib-config}

`weapp.lib` 用于把项目切换到“小程序库模式”。

启用后，`weapp-vite` 不再按应用模式去生成 `app.json`、页面路由和整套应用产物，而是只围绕你声明的入口输出：

- 组件
- 业务模块
- 类型文件

[[toc]]

## `weapp.lib` {#weapp-lib}

- **类型**：
  ```ts
  {
    entry: string | string[] | Record<string, string>
    root?: string
    outDir?: string
    preservePath?: boolean
    fileName?: string | ((ctx: { name: string; input: string }) => string)
    componentJson?: boolean | 'auto' | ((ctx: { name: string; input: string }) => Record<string, any>)
    dts?: boolean | WeappLibDtsOptions
  }
  ```

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    lib: {
      entry: {
        button: 'components/button/index.vue',
        card: 'components/card/index.vue',
      },
      outDir: 'dist-lib',
      preservePath: true,
      componentJson: 'auto',
    },
  },
})
```

## 字段说明

### `entry`

- **类型**：`string | string[] | Record<string, string>`

必填。支持：

- 单入口
- 多入口数组
- 具名入口对象

### `root`

- **类型**：`string`

库源码根目录。默认沿用 `weapp.srcRoot`。

### `outDir`

- **类型**：`string`

库产物输出目录。默认沿用顶层 `build.outDir`。

### `preservePath`

- **类型**：`boolean`

是否保留源码相对路径。默认一般更适合组件库场景。

### `fileName`

- **类型**：`string | ((ctx) => string)`

自定义入口输出文件名或路径。

适合：

- 统一输出成 `${name}/index`
- 精确控制多入口发布目录结构

### `componentJson`

- **类型**：`boolean | 'auto' | ((ctx) => Record<string, any>)`

控制是否自动生成组件 JSON。

行为建议：

- `false`：完全手动维护
- `true`：始终生成
- `'auto'`：缺少 JSON 且看起来像组件入口时自动生成
- `function`：按入口动态返回 JSON 内容

## `weapp.lib.dts` {#weapp-lib-dts}

- **类型**：`boolean | WeappLibDtsOptions`

用于控制声明文件输出。

`WeappLibDtsOptions` 主要包括：

```ts
{
  enabled?: boolean
  mode?: 'internal' | 'vue-tsc'
  internal?: {
    tsconfig?: string | false
    compilerOptions?: CompilerOptions
    vueCompilerOptions?: Record<string, any>
  }
  rolldown?: RolldownDtsOptions
  vueTsc?: {
    tsconfig?: Record<string, any>
    compilerOptions?: CompilerOptions
    vueCompilerOptions?: Record<string, any>
  }
}
```

示例：

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: ['components/button/index.vue'],
      dts: {
        mode: 'vue-tsc',
        vueTsc: {
          compilerOptions: {
            declarationMap: true,
          },
        },
      },
    },
  },
})
```

### `mode` 怎么选

- `internal`：默认模式，成本更低，适合大多数场景
- `vue-tsc`：更贴近 Vue 生态类型链路，适合你明确依赖 `vue-tsc` 行为时使用

## 常见组合

### 保留源码路径

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: ['components/button/index.vue'],
      preservePath: true,
    },
  },
})
```

适合源目录结构本身就想作为发布结构保留。

### 统一输出成 `[name]/index`

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: {
        button: 'components/button/index.vue',
        card: 'components/card/index.vue',
      },
      preservePath: false,
      fileName: ({ name }) => `${name}/index`,
    },
  },
})
```

适合构建稳定、统一的发布目录。

## 与顶层 `build.*` 的边界

`weapp.lib` 负责的是“进入库模式以及小程序库语义”。

但这些底层构建项仍然属于 Vite / Rolldown 顶层配置：

- `build.rolldownOptions.external`
- `build.target`
- `build.minify`
- `build.sourcemap`

例如发布 npm 组件库时 external 掉 `wevu`：

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: ['components/button/index.vue'],
    },
  },
  build: {
    rolldownOptions: {
      external: [/^wevu(?:\\/.*)?$/],
    },
  },
})
```

更多原生字段说明请看：

- [Vite 中文官方配置文档 · build](https://cn.vite.dev/config/build-options)

## 常见问题

### 为什么多入口产物互相覆盖

优先检查：

- `preservePath`
- `fileName`

是否把多个入口映射到了同一个输出路径。

### `componentJson: 'auto'` 没生成 JSON

说明当前入口没有被识别成“适合自动生成组件 JSON”的组件入口。此时改成：

- `true`
- 或函数形式显式返回 JSON

### 库模式还能用共享 chunk 吗

可以。多入口共享模块时，仍然会受到 [共享 Chunk 配置](./chunks.md) 的影响。

---

如果你要继续处理顶层生成参数，请看 [Vite 中文官方配置文档](https://cn.vite.dev/config/)。如果你接下来要做代码生成骨架，请继续看 [生成脚手架配置](./generate.md)。
