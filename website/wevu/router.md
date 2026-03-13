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

:::warning 安装方式
`wevu` 请安装到 `devDependencies`：

```sh
pnpm add -D wevu
```

不要把它放到 `dependencies`。
:::

## 什么时候使用

- 想把页面跳转从“零散 `wx.navigateTo` 调用”升级到统一导航入口
- 想把跳转前判断收敛到 `beforeEach` / `beforeResolve` / `beforeEnter`
- 想获得更接近 Vue Router 的 `resolve()`、`currentRoute` 与失败分类能力

## 最小示例

```ts
import { useRouter } from 'wevu/router'

const router = useRouter()

await router.push('/pages/home/index')
await router.replace('/pages/profile/index?tab=security')
await router.back(1)
```

## 核心能力

- `useRouter()`：创建带守卫、失败分类的高阶路由器
- `useRoute()`：读取当前路由快照
- `resolveRouteLocation()`：预解析目标位置
- `parseQuery()` / `stringifyQuery()`：query 处理工具
- `createNavigationFailure()` / `isNavigationFailure()`：失败对象与判定
- `NavigationFailureType`：失败类别枚举

## 常见心智

### 路径优先

```ts
await router.push('/pages/post/1/index?preview=0')
```

在小程序里，页面物理路径本身就是分包、注册和跳转语义的一部分，所以文档更推荐你直接使用真实页面路径。

### 守卫用于统一前置判断

```ts
const router = useRouter({
  beforeEach(to) {
    if (to.path.startsWith('/pages/private/') && !isLoggedIn()) {
      return '/pages/login/index'
    }
  },
})
```

这样比把跳转限制散落在各个页面里更容易维护。

### 小程序不支持真正 forward 栈

```ts
const result = await router.forward()
```

这在小程序里通常会返回 `NavigationFailureType.aborted`，属于预期行为，不是 bug。

## 调试与迁移建议

- 用 `resolve()` 提前检查 `href / matched / redirectedFrom`
- 把业务里的零散跳转判断迁移到守卫，而不是继续散落在页面逻辑里
- 优先保留小程序真实路径，不要过早抽象成重度命名路由体系

## 相关页面

- [wevu/api-reference/setup-context](/wevu/api-reference/setup-context)
- [wevu/api-reference/runtime-bridge](/wevu/api-reference/runtime-bridge)
- [wevu/api-package](/wevu/api-package)
