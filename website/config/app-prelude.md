---
title: App Prelude 配置
description: weapp.appPrelude 的配置说明，覆盖 app.prelude 前置脚本开关、注入模式与产物行为。
keywords:
  - 配置
  - appPrelude
  - app.prelude
  - prelude
---

# App Prelude 配置 {#app-prelude-config}

这一页介绍 `weapp.appPrelude` 的配置。它控制 `src/app.prelude.ts` 或 `src/app.prelude.js` 的注入方式。

如果你想先理解这个功能解决什么问题，请看 [App Prelude](/guide/app-prelude)。

[[toc]]

## `weapp.appPrelude` {#weapp-appprelude}

- **类型**：

```ts
boolean | {
  enabled?: boolean
  mode?: 'inline' | 'entry' | 'require'
  webRuntime?: boolean | WeappWebRuntimeConfig
}
```

- **默认值**：`{ mode: 'require' }`

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    appPrelude: {
      enabled: true,
      mode: 'require',
    },
  },
})
```

### `enabled`

- **类型**：`boolean`

是否启用 `app.prelude` 注入。设置为 `false` 后，即使源码目录下存在 `app.prelude.ts` 或 `app.prelude.js`，也不会注入。

### `mode`

- **类型**：`'inline' | 'entry' | 'require'`
- **默认值**：`'require'`

| 值 | 行为 | 适合场景 |
| --- | --- | --- |
| `inline` | 把 prelude 代码内联到目标 JS chunk 顶部 | 追求最早执行时机，可以接受重复代码 |
| `entry` | 只注入到 `app`、页面、组件入口 chunk | 希望控制注入范围 |
| `require` | 生成作用域级 `app.prelude.js`，再在 chunk 顶部静态 `require` | 默认推荐，兼顾执行时机和产物体积 |

`require` 模式下，主包、普通分包和独立分包会各自拿到对应作用域的 `app.prelude.js`。

> [!NOTE]
> `app.prelude` 当前仅支持无 `import` / `export` 的自包含脚本。

## 产物说明

启用 `appPrelude` 后，构建产物中可能出现：

| 产物 | 说明 |
| --- | --- |
| `app.prelude.js` | `require` 模式下按作用域生成的前置脚本 |
| 入口 JS 顶部的 `require(...)` | 用于提前执行对应作用域的 `app.prelude.js` |

## 常见配置

### 使用默认注入模式

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'require',
    },
  },
})
```

### 关闭前置脚本注入

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      enabled: false,
    },
  },
})
```

## 继续阅读

- [App Prelude](/guide/app-prelude)
- [Web Runtime 全局对象注入配置](/config/web-runtime-globals)
- [共享配置](/config/shared)
