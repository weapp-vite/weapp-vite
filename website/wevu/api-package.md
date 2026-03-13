---
title: wevu/api
description: 说明 wevu/api 的跨端 API 门面定位、与 uni/taro 风格对象的类比关系，以及在 Wevu 项目中的完整调用方式。
keywords:
  - wevu/api
  - "@wevu/api"
  - wevu
  - namespace
  - uni
  - taro
---

# `wevu/api`

`wevu/api` 不是一个零散工具集合，而应该被理解成一个“跨端 API 门面对象”。

如果你熟悉 `uni` 或 `Taro` 的全局 API 心智，可以把它理解成同一类东西：

- 业务层不直接依赖单个平台的 `wx / my / tt`
- 统一通过一个对象来调用小程序能力
- 由这层对象负责“平台探测、方法映射、Promise 化、能力缺失时的错误语义”

在 Wevu 体系里，这个角色就是 `wpi`，而 `wevu/api` 则是 `@wevu/api` 在 `wevu/*` 命名空间下的入口。

:::warning 安装方式
`wevu` 请安装在 `devDependencies` 中，而不是 `dependencies`。

推荐写法：

```sh
pnpm add -D wevu
```

原因是 Weapp-vite 会把这类构建期依赖内联到产物里；如果误放到 `dependencies`，通常会被当成运行时 npm 依赖处理，增加产物体积与依赖落位复杂度。
:::

## 它和 `@wevu/api` 的关系

- `wevu/api`：Wevu 体系下的子路径入口
- `@wevu/api`：真正的独立包本体
- 当前导出语义：`wevu/api` 等价于 `export * from '@wevu/api'`

也就是说，`wevu/api` 本质上是“命名空间更统一的入口”，不是另一套独立实现。

## 推荐怎么理解它

不要把它理解成“几个请求工具函数”。

更准确的理解是：

- `wpi` 像 `uni` / `Taro` 暴露出来的统一 API 对象
- 你可以把它当成“跨端版 `wx`”
- 你写的是微信命名 API
- 底层会根据当前宿主平台，决定是直连、显式映射，还是返回 unsupported

例如：

```ts
import { wpi } from 'wevu/api'

await wpi.showToast({
  title: '保存成功',
  icon: 'success',
})
```

这段代码的业务心智是“调用一个统一 API 对象”，而不是“我现在一定跑在微信上，所以我要手动写 `wx.showToast`”。

## 适合什么场景

- 你已经在项目里使用 `wevu`，希望导入路径统一走 `wevu/*`
- 你想通过一个对象统一调用 `wx / my / tt` 等平台能力
- 你希望业务层保持“微信命名 API”写法，同时把平台映射收敛到底层
- 你希望兼顾 Promise 风格与传统回调风格

## 导出项总览

这页最常用的导出有两个：

- `wpi`
- `createWeapi`

```ts
import { createWeapi, wpi } from 'wevu/api'
```

### `wpi`

默认实例，推荐直接使用。

特点：

- 自动探测当前运行平台对象
- 自动做方法映射
- 自动处理 Promise / 回调两种调用语义

### `createWeapi`

手动创建一个 API 实例。

适合场景：

- 测试环境
- 需要显式绑定某个平台对象
- 想在运行时切换 adapter

## 可调用方式一览

这部分是最重要的。`wevu/api` 的“可调用方式”，可以分成 8 类。

### 1. 默认实例调用

最常见、最推荐的方式：

```ts
import { wpi } from 'wevu/api'

await wpi.request({
  url: 'https://example.com/api/list',
  method: 'GET',
})
```

这里的 `wpi` 就是“跨端 API 门面对象”。

### 2. Promise 风格调用

如果最后一个参数里没有传 `success/fail/complete`，则默认走 Promise 风格：

```ts
import { wpi } from 'wevu/api'

const res = await wpi.chooseImage({
  count: 1,
})
```

这也是最推荐的业务写法。

### 3. 回调风格调用

如果你传了小程序传统回调字段，它会保留原有回调语义：

```ts
import { wpi } from 'wevu/api'

wpi.request({
  url: 'https://example.com/api/list',
  success(res) {
    console.log(res.data)
  },
  fail(error) {
    console.error(error)
  },
})
```

这让老代码可以渐进迁移，而不是一次性全改 Promise。

### 4. `*Sync` 直连调用

对于同步 API，不会 Promise 化，直接保持宿主原语义：

```ts
import { wpi } from 'wevu/api'

const systemInfo = wpi.getSystemInfoSync()
const storage = wpi.getStorageSync({ key: 'token' })
```

心智上可以直接把它当成“统一版的同步平台 API”。

### 5. `onXxx / offXxx` 事件订阅调用

对于事件订阅类 API，也不会 Promise 化：

```ts
import { wpi } from 'wevu/api'

function onResize(res: any) {
  console.log('resize', res)
}

wpi.onWindowResize(onResize)
wpi.offWindowResize(onResize)
```

这类 API 保持和平台原生对象一致的调用习惯。

### 6. 显式创建实例调用

如果你不想依赖自动探测，可以手动创建实例：

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

这很适合测试、沙箱运行、或多宿主适配实验。

### 7. 能力探测调用

`wevu/api` 不只是“调用”，还支持“先判断再调用”。

#### `resolveTarget(method)`

查看某个微信命名 API 在当前平台会映射到什么：

```ts
import { wpi } from 'wevu/api'

const target = wpi.resolveTarget('showToast')

console.log(target.method)
console.log(target.target)
console.log(target.platform)
console.log(target.supported)
console.log(target.supportLevel)
console.log(target.semanticAligned)
```

你可以把它理解成“路由表查询”或“平台适配结果解释器”。

#### `supports(method, options?)`

判断某个 API 是否可用：

```ts
import { wpi } from 'wevu/api'

if (wpi.supports('chooseImage')) {
  await wpi.chooseImage({ count: 1 })
}

if (wpi.supports('showToast', { semantic: true })) {
  await wpi.showToast({ title: 'ok' })
}
```

其中：

- 默认 `supports('xxx')` 只看“能不能调用”
- `supports('xxx', { semantic: true })` 看“是不是语义对齐的调用”

### 8. 运行时读取和切换 adapter

实例本身也暴露了 adapter 管理能力。

#### `platform`

读取当前平台标识：

```ts
import { wpi } from 'wevu/api'

console.log(wpi.platform)
```

#### `raw`

读取当前宿主原始对象：

```ts
import { wpi } from 'wevu/api'

console.log(wpi.raw)
```

#### `getAdapter()`

获取当前实例绑定的 adapter：

```ts
import { wpi } from 'wevu/api'

const adapter = wpi.getAdapter()
```

#### `setAdapter(adapter, platform?)`

运行时替换 adapter：

```ts
import { createWeapi } from 'wevu/api'

const api = createWeapi()

api.setAdapter(my, 'my')
await api.showToast({ title: '支付宝环境', icon: 'none' })
```

这在测试里尤其有用。

## 一句话总结这些调用方式

你可以把 `wevu/api` 理解成：

- 一个统一 API 对象：像 `uni` / `Taro`
- 一个默认实例：`wpi`
- 一个实例工厂：`createWeapi`
- 一套能力探测接口：`resolveTarget` / `supports`
- 一组运行时 adapter 控制接口：`platform / raw / getAdapter / setAdapter`

## 业务里最常见的写法

如果你只是日常写业务，通常只会用这两种：

### 写法 A：直接用 `wpi`

```ts
import { wpi } from 'wevu/api'

await wpi.request({
  url: 'https://example.com/api/todos',
})

await wpi.showToast({
  title: '加载完成',
  icon: 'success',
})
```

### 写法 B：先判断能力再调用

```ts
import { wpi } from 'wevu/api'

if (wpi.supports('chooseAddress')) {
  await wpi.chooseAddress()
}
else {
  await wpi.showToast({
    title: '当前平台暂不支持地址选择',
    icon: 'none',
  })
}
```

## 关于“全量 API 列表”

`wevu/api` 理论上可以调用微信命名体系下的大量 API，数量非常多，不适合在这一页逐条罗列。

更实用的阅读方式是：

- 在这里理解“对象心智”和“调用方式”
- 去 [@wevu/api 包文档](/packages/weapi/) 看平台支持矩阵和独立包说明
- 在编辑器里直接通过 `wpi.` 获得类型提示与补全

换句话说，这一页回答的是“怎么用这层对象”，而不是“把 400 多个方法名机械抄一遍”。

## 何时仍然直接看 `@wevu/api` 文档

当你需要：

- 查看独立包定位与发布说明
- 了解平台支持矩阵
- 跟踪 `@wevu/api` 自身的能力边界
- 查看更偏独立包视角的说明

请直接阅读 [@wevu/api 包文档](/packages/weapi/)。

## 相关页面

- [wevu/fetch](/wevu/fetch)
- [wevu/router](/wevu/router)
- [运行时与生命周期](/wevu/runtime)
