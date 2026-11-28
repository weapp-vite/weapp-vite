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
boolean | (
  | {
      enabled?: boolean
      mode?: 'inline' | 'entry' | 'require'
      webRuntime?: boolean | WeappWebRuntimeConfig
    }
  | {
      enabled?: boolean
      mode: 'native'
      webRuntime?: boolean | WeappNativeWebRuntimeConfig
    }
)
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

是否启用 `app.prelude` 注入。设置为 `false` 后，即使源码目录下存在 `app.prelude.ts` 或 `app.prelude.js`，也不会注入。`mode: 'native'` 也不会启用 Rolldown 原生 Web Runtime 注入；已配置的 `webRuntime` 继续使用旧模式路径。

### `mode`

- **类型**：`'inline' | 'entry' | 'require' | 'native'`
- **默认值**：`'require'`

| 值 | 自定义前置脚本行为 | Web Runtime 绑定行为 | 适合场景 |
| --- | --- | --- | --- |
| `inline` | 把 prelude 代码内联到目标 JS chunk 顶部 | 旧版源码与产物改写 | 追求最早执行时机，可以接受重复代码 |
| `entry` | 只注入到 `app`、页面、组件入口 chunk | 旧版源码与产物改写 | 希望控制前置脚本注入范围 |
| `require` | 生成作用域级 `app.prelude.js`，再在 chunk 顶部静态 `require` | 旧版源码与产物改写 | 默认推荐，兼顾执行时机和产物体积 |
| `native` | 自定义 Prelude 作为普通静态模块执行 | Rolldown 精确注入与按需全局桥接 | 需要精确绑定、最小全局兼容、共享 chunk 与动态导入支持 |

`require` 模式下，主包、普通分包和独立分包会各自拿到对应作用域的 `app.prelude.js`。

`native` 是新增的第四种模式，必须显式选择。自由标识符与 `globalThis.<target>` 等全局对象点号访问使用 Rolldown 原生 `transform.inject`，字符串计算属性、全局解构与别名等不可点号注入的访问使用按目标裁剪的幂等桥接；自定义 `app.prelude` 作为普通静态模块执行，不再生成 `app.prelude.js`、安装器或 eager 状态。未选择 `native` 时，原有三种模式、默认值和注入路径保持不变。Web Runtime 目标与 `globalTargets` 见 [Web Runtime 全局对象注入配置](/config/web-runtime-globals)。

> [!NOTE]
> `app.prelude` 当前仅支持无 `import` / `export` 的自包含脚本。
>
> `native` 要求 `appPrelude.enabled !== false`。`appPrelude.webRuntime` 在该模式下行为固定为精确最优解，无策略开关：自由标识符与全局对象点号访问精确绑定（可 tree-shake、不写全局），字符串计算属性、全局解构、别名与 `globalTargets` 声明的目标生成幂等桥接。桥接保留完整宿主实现，替换缺失、占位或上一轮 native 安装的值，并按目标修补已知能力缺口；写入使用受保护的 `globalThis[key]`，不依赖 `Reflect.get/set`。分包交给打包器自然分组。用户只用 `targets` 选择绑定资格（opt-out 作用域，实际进包量由 tree-shake 裁剪）、`globalTargets` 精确补充静态推断不到的隐藏访问（独立于 `targets` 绑定资格，安装声明目标及其必要依赖闭包），不全量安装与声明无关的未用实现。Web Runtime 的求值顺序始终由普通模块依赖保证；Prelude 自身引用目标时遵循相同规则，binding 不会反向依赖 Prelude。
>
> 旧模式与未指定 `mode` 时，嵌套 Web Runtime 始终提前安装；需要旧模式延迟安装时，使用顶层 `weapp.injectWebRuntimeGlobals.prelude: false`。

## 产物说明

启用 `appPrelude` 后，构建产物中可能出现：

| 产物 | 说明 |
| --- | --- |
| `app.prelude.js` | `require` 模式下按作用域生成的前置脚本 |
| 普通 Prelude 模块 | `native` 模式下的自定义前置脚本，由 bundler 按模块图输出，不保证固定文件名 |
| 精确绑定与目标级桥接 | `native` 模式下按真实引用和全局语义建立依赖；点号全局访问走精确绑定，桥接只覆盖不可点号注入的显式访问与 `globalTargets` 声明的目标，不全量安装 |
| 独立 App Prelude vendor | `native` 模式注册一条分组规则，把自定义前置脚本单独拆成 `weapp-vendors/web-runtime-app-prelude.js`；绑定与桥接的分包交给打包器自然分组 |

## 常见配置

### 精确补充隐藏全局访问

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        targets: ['fetch', 'Request'],
        // 静态推断不到的隐藏计算访问，按目标精确补充安装，不全量安装未用实现。
        globalTargets: ['Response'],
      },
    },
  },
})
```

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

### 使用 Rolldown 原生 Web Runtime 注入

```ts
export default defineConfig({
  weapp: {
    appPrelude: {
      mode: 'native',
      webRuntime: {
        enabled: true,
        targets: ['fetch', 'XMLHttpRequest'],
      },
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
