---
title: Vite 插件识别 weapp-vite 宿主
description: 在自定义 Vite 插件中判断当前运行环境是否由 weapp-vite 创建，并区分 miniprogram 与 web 两种运行面。
keywords:
  - weapp-vite
  - 宿主元信息
  - configResolved
  - 运行面判断
  - 小程序构建
  - Web 运行时
---

# Vite 插件识别 weapp-vite 宿主

当你把一个自定义 Vite 插件同时用于 `weapp-vite` 和普通 `vite` 项目时，常见需求是：

- 只在 `weapp-vite` 场景下注入额外逻辑；
- 在 `weapp-vite` 里继续区分 `miniprogram` 与 `web` 两种运行面；
- 避免使用 `process.env` 这类进程级变量，防止同进程里的其他 Vite 实例被误判。

从当前版本开始，`weapp-vite` 会给自己创建的 Vite 实例注入 `config.weappVite` 宿主元信息。你可以在插件的 `config`、`configResolved` 等阶段读取这份信息来做判断。

## 宿主元信息结构

`weapp-vite` 会向 Vite 配置对象注入下面这个字段：

```ts
interface WeappViteHostMeta {
  name: 'weapp-vite'
  runtime: 'miniprogram' | 'web'
}
```

- `name` 固定为 `'weapp-vite'`，用于判断当前实例是否由 `weapp-vite` 创建。
- `runtime` 用于区分当前运行面：
  - `miniprogram`：小程序构建链路，包括主包、分包、pluginRoot、workers。
  - `web`：`weapp.web` 启用后的 Web 运行时与对应的 Vite 实例。

普通 `vite` 项目不会自动带上这个字段。

## 推荐写法

最直接的写法是在 `configResolved` 中读取 `config.weappVite`：

```ts
import type { Plugin } from 'vite'

export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    configResolved(config) {
      if (config.weappVite?.name !== 'weapp-vite') {
        return
      }

      if (config.weappVite.runtime === 'miniprogram') {
        // 只在 weapp-vite 小程序运行面生效
      }

      if (config.weappVite.runtime === 'web') {
        // 只在 weapp-vite web 运行面生效
      }
    },
  }
}
```

如果你希望把判断逻辑收敛到一个 helper，也可以直接使用 `weapp-vite` 导出的工具函数：

```ts
import type { Plugin } from 'vite'
import { isWeappViteHost, resolveWeappViteHostMeta } from 'weapp-vite'

export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    configResolved(config) {
      if (!isWeappViteHost(config)) {
        return
      }

      const host = resolveWeappViteHostMeta(config)
      if (!host) {
        return
      }

      if (host.runtime === 'miniprogram') {
        // 小程序逻辑
      }
    },
  }
}
```

## 对应处理方式

拿到宿主信息后，推荐按下面的粒度处理，而不是只做一个粗糙的布尔判断。

### 1. 普通 Vite

```ts
if (!config.weappVite) {
  // 保持普通 Vite 行为
}
```

适合的处理方式：

- 走插件默认逻辑；
- 跳过 weapp-vite 专属 transform、文件发射或小程序路径重写；
- 不要假设存在 `weapp` 配置、WXML/WXSS 产物或小程序输出目录。

### 2. weapp-vite + miniprogram

```ts
if (config.weappVite?.runtime === 'miniprogram') {
  // 小程序运行面
}
```

适合的处理方式：

- 启用只服务于小程序构建的逻辑；
- 处理小程序专属文件类型、路径规则、产物后缀或构建阶段行为；
- 针对 pluginRoot、workers、分包等链路复用同一套判断，因为它们都属于 `miniprogram`。

### 3. weapp-vite + web

```ts
if (config.weappVite?.runtime === 'web') {
  // Web 运行面
}
```

适合的处理方式：

- 使用浏览器可运行的分支；
- 跳过只能在小程序产物里成立的 emit/rename 逻辑；
- 如果你的插件既处理小程序源码，又支持 H5 调试，可以把浏览器兼容逻辑集中到这里。

## 为什么不推荐 `process.env`

不推荐用下面这种方式判断：

```ts
if (process.env.WEAPP_VITE) {
  // 不推荐
}
```

原因很直接：

- `process.env` 是进程级共享状态，不是当前 Vite 实例私有状态；
- 同一个 Node 进程里可能同时存在多个 Vite 实例；
- 这类标记很难可靠地区分 `miniprogram` 和 `web` 两种运行面。

`config.weappVite` 则是当前实例级别的元信息，作用域更清晰，也更适合插件判断。

## 类型与导入位置

你可以从下面两个入口获得类型与 helper：

```ts
import type { WeappViteHostMeta, WeappViteRuntime } from 'weapp-vite'
import {
  isWeappViteHost,
  resolveWeappViteHostMeta

} from 'weapp-vite'
```

或：

```ts
import type { WeappViteHostMeta, WeappViteRuntime } from 'weapp-vite/config'
import {
  isWeappViteHost,
  resolveWeappViteHostMeta

} from 'weapp-vite/config'
```

如果你只是在插件内部读取 `config.weappVite`，不引入 helper 也完全可以。

## 适用范围说明

当前宿主元信息由 `weapp-vite` 在内部合并配置时注入，因此以下链路都可以读取到：

- 常规小程序 `dev/build`
- 启用 `pluginRoot` 的插件构建
- workers 构建
- `weapp.web` 对应的 Web 运行面

如果你自己直接调用原生 `vite.createServer()` 或 `vite.build()`，且没有经过 `weapp-vite` 的配置合并链路，那么不会自动得到该字段，这属于预期行为。
