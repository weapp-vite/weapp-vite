---
title: wevu/router
description: wevu/router 子路径文档，介绍路径式导航、守卫、失败分类与小程序环境下的边界。
keywords:
  - wevu/router
  - router
  - wevu
  - navigation
---

# `wevu/router`

`wevu/router` 是 Wevu 提供的独立路由子入口，目标是尽量对齐 Vue Router 的导航心智，同时保持对小程序路由能力边界的明确约束。

如果你只需要拿到原生页面路由对象，请继续使用 `wevu` 主入口里的 `useNativeRouter()` / `useNativePageRouter()`；如果你需要守卫、失败分类、`resolve()` 与更统一的导航封装，请使用 `wevu/router`。

> **注意**：`wevu` 根入口没有 `useRouter()`。`useRouter()` 是 `wevu/router` 子入口的 API。

:::tip 创建与获取

- `createRouter()`：负责创建并注册默认 router 实例
- `useRouter()`：负责获取当前已创建的 router 实例

推荐在应用入口或上层 `setup()` 中先调用一次 `createRouter()`，后续业务代码里再通过 `useRouter()` 读取。
:::

:::warning 安装方式
在 `weapp-vite` 项目里，`wevu` 通常建议安装到 `devDependencies`：

```sh
pnpm add -D wevu
```

如果你是在非 `weapp-vite` 场景单独消费 `wevu/router`，则应按自己的发布方式决定依赖落位。
:::

## 1. 什么时候使用

- 想把页面跳转从“零散 `wx.navigateTo` 调用”升级到统一导航入口
- 想把跳转前判断收敛到 `beforeEach` / `beforeResolve` / `beforeEnter`
- 想获得更接近 Vue Router 的 `resolve()`、`currentRoute` 与失败分类能力

## 2. 最小示例

```ts
import { createRouter, useRouter } from 'wevu/router'

// 在应用入口或上层 setup 中先创建一次
createRouter()

// 业务代码里只负责获取实例
const router = useRouter()

await router.push('/pages/home/index')
await router.replace('/pages/profile/index?tab=security')
await router.back(1)
```

## 3. 在 App 中注册

推荐在应用入口或 App 级 `setup()` 中创建一次 router：

```ts
import { createApp } from 'wevu'
import { createRouter } from 'wevu/router'

const router = createRouter()

createApp({
  setup() {
    // 这里通常不需要额外返回 router
  },
}).use(router)
```

如果你只是想让后续页面/组件里的 `useRouter()` 能拿到默认实例，最关键的是这句：

```ts
const router = createRouter()
```

`createRouter()` 创建时就会注册当前默认 router；`createApp(...).use(router)` 则会把它同步挂到 `app.config.globalProperties.$router`。

### 3.1 `app.vue` + `<script setup>` 写法

如果你使用的是 Weapp-vite + Vue SFC，通常可以直接在 `app.vue` 顶层创建：

```vue
<script setup lang="ts">
import { createRouter } from 'wevu/router'

createRouter()
</script>
```

关键点：

- 必须是顶层语句
- 不要放进 `onLaunch()`、`onShow()` 或其他 hook 里
- 这样后续页面/组件里的 `useRouter()` 才能直接拿到默认实例

## 4. 核心能力

- `useRouter()`：获取当前已创建的路由实例
- `createRouter()`：创建带守卫、失败分类的高阶路由器
- `useRoute()`：读取当前路由快照
- `resolveRouteLocation()`：预解析目标位置
- `parseQuery()` / `stringifyQuery()`：query 处理工具
- `createNavigationFailure()` / `isNavigationFailure()`：失败对象与判定
- `NavigationFailureType`：失败类别枚举

## 5. 常见心智

### 5.1 路径优先

```ts
await router.push('/pages/post/1/index?preview=0')
```

在小程序里，页面物理路径本身就是分包、注册和跳转语义的一部分，所以文档更推荐你直接使用真实页面路径。

### 5.2 守卫用于统一前置判断

```ts
import { createRouter } from 'wevu/router'

const router = createRouter({
  beforeEach(to) {
    if (to.path.startsWith('/pages/private/') && !isLoggedIn()) {
      return '/pages/login/index'
    }
  },
})
```

这样比把跳转限制散落在各个页面里更容易维护。

### 5.3 小程序不支持真正 forward 栈

```ts
const result = await router.forward()
```

这在小程序里通常会返回 `NavigationFailureType.aborted`，属于预期行为，不是 bug。

## 6. 调试与迁移建议

- 用 `resolve()` 提前检查 `href / matched / redirectedFrom`
- 把业务里的零散跳转判断迁移到守卫，而不是继续散落在页面逻辑里
- 优先保留小程序真实路径，不要过早抽象成重度命名路由体系

## 7. 速查表

| 需求                    | 建议 API                            |
| ----------------------- | ----------------------------------- |
| 获取高阶 router 实例    | `useRouter()` from `wevu/router`    |
| 获取当前 route 快照     | `useRoute()`                        |
| 获取页面路径语义 Router | `useNativePageRouter()` from `wevu` |
| 获取组件路径语义 Router | `useNativeRouter()` from `wevu`     |

## 8. 相关页面

- [wevu/api/setup-context](/wevu/api/setup-context)
- [wevu/api/runtime-bridge](/wevu/api/runtime-bridge)
- [wevu/api-package](/wevu/api-package)
