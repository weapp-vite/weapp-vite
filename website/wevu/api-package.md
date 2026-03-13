---
title: wevu/api
description: 说明 wevu/api 子路径导出的定位、与 @wevu/api 的关系，以及在 Wevu 项目中的推荐使用方式。
keywords:
  - wevu/api
  - "@wevu/api"
  - wevu
  - namespace
---

# `wevu/api`

`wevu/api` 是 `wevu` 提供的子路径导出，用来透传 `@wevu/api` 的能力。它的目标不是重新发明一套 API，而是让已经安装 `wevu` 的项目，可以继续在 `wevu` 命名空间下按需获取跨平台小程序 API 适配层。

:::warning 安装方式
`wevu` 请安装在 `devDependencies` 中，而不是 `dependencies`。

推荐写法：

```sh
pnpm add -D wevu
```

原因是 Weapp-vite 会把这类构建期依赖内联到产物里；如果误放到 `dependencies`，通常会被当成运行时 npm 依赖处理，增加产物体积与依赖落位复杂度。
:::

## 它和 `@wevu/api` 的关系

- `wevu/api`：子路径别名，便于在 Wevu 体系里统一导入风格。
- `@wevu/api`：独立包本体，负责跨平台 API 封装与适配。
- 导出语义：`wevu/api` 当前等价于 `export * from '@wevu/api'`。

因此如果你已经熟悉 `@wevu/api`，可以把它理解成一个更贴近 Wevu 文档体系的入口。

## 适合什么场景

- 你已经在项目里使用 `wevu`，希望导入路径统一走 `wevu/*`
- 你想通过 `wpi` 统一调用 `wx / my / tt` 等平台 API
- 你希望在文档、示例、类型导入上减少对多个包名的切换

## 基本用法

```ts
import { wpi } from 'wevu/api'

const res = await wpi.request({
  url: 'https://example.com/api/list',
  method: 'GET',
})

console.log(res.data)
```

## 显式创建适配器

```ts
import { createWeapi } from 'wevu/api'

const api = createWeapi({
  adapter: wx,
  platform: 'wx',
})

await api.showToast({
  title: 'hello',
  icon: 'none',
})
```

## 何时仍然直接看 `@wevu/api` 文档

当你需要：

- 查看独立包定位与发布说明
- 了解 API 兼容矩阵
- 跟踪 `@wevu/api` 自身的能力边界

请直接阅读 [@wevu/api 包文档](/packages/weapi)。

## 相关页面

- [wevu/fetch](/wevu/fetch)
- [wevu/router](/wevu/router)
- [运行时与生命周期](/wevu/runtime)
