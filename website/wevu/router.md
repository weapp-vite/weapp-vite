---
title: wevu/router
description: wevu/router 子路径文档，介绍路由器初始化、命名路由、守卫、动态路由与小程序环境下的边界。
keywords:
  - wevu/router
  - router
  - wevu
  - navigation
---

# `wevu/router`

`wevu/router` 是 Wevu 提供的独立路由子入口，目标是尽量对齐 Vue Router 的使用心智，同时保持对小程序路由能力边界的明确约束。

如果你只需要拿到原生页面路由对象，请继续使用 `wevu` 主入口里的 `useNativeRouter()` / `useNativePageRouter()`；如果你需要命名路由、守卫、失败分类、`resolve()` 与动态路由管理，请使用 `wevu/router`。

:::warning 安装方式
`wevu` 请安装到 `devDependencies`：

```sh
pnpm add -D wevu
```

不要把它放到 `dependencies`。
:::

## 什么时候使用

- 想把页面跳转从“硬编码 URL 字符串”升级到“命名路由 + params”
- 想把跳转前判断收敛到 `beforeEach` / `beforeResolve` / `beforeEnter`
- 想获得更接近 Vue Router 的 `resolve()`、`currentRoute`、失败分类与动态路由管理能力

## 最小示例

```ts
import { useRouter } from 'wevu/router'

const router = useRouter()

await router.push('/pages/home/index')
await router.replace('/pages/profile/index?tab=security')
await router.back(1)
```

## 核心能力

- `useRouter()`：创建带守卫、失败分类、命名路由解析的高阶路由器
- `useRoute()`：读取当前路由快照
- `resolveRouteLocation()`：预解析目标位置
- `parseQuery()` / `stringifyQuery()`：query 处理工具
- `createNavigationFailure()` / `isNavigationFailure()`：失败对象与判定
- `NavigationFailureType`：失败类别枚举

## 常见心智

### 命名路由优先

```ts
const router = useRouter({
  paramsMode: 'strict',
  routes: [
    { name: 'home', path: '/pages/home/index' },
    {
      name: 'post-detail',
      path: '/pages/post/:id/index',
      beforeEnter: (to) => {
        if (to.query.preview === '1') {
          return '/pages/preview/index'
        }
      },
    },
  ],
})

await router.push({ name: 'post-detail', params: { id: 1 } })
```

相比手写 `/pages/post/1/index`，命名路由更适合做类型约束、统一迁移和重构。

### `routes` 是推荐入口

```ts
const router = useRouter({
  routes: [
    { name: 'home', path: '/pages/home/index' },
  ],
})
```

`namedRoutes` 仍然保留用于兼容旧写法，但新文档和新项目建议统一使用 `routes`。

### 小程序不支持真正 forward 栈

```ts
const result = await router.forward()
```

这在小程序里通常会返回 `NavigationFailureType.aborted`，属于预期行为，不是 bug。

## 动态路由管理

```ts
const remove = router.addRoute({
  name: 'legacy-home',
  path: '/pages/legacy/index',
})

console.log(router.hasRoute('legacy-home'))
console.log(router.getRoutes())

remove()
router.removeRoute('legacy-home')
```

## 调试与迁移建议

- 先用 `paramsMode: 'loose'` 接管老项目，再逐步切到 `strict`
- 用 `resolve()` 提前检查 `href / matched / redirectedFrom`
- 把业务里的零散跳转判断迁移到守卫，而不是继续散落在页面逻辑里

## 相关页面

- [wevu/api-reference/setup-context](/wevu/api-reference/setup-context)
- [wevu/api-reference/runtime-bridge](/wevu/api-reference/runtime-bridge)
- [wevu/api-package](/wevu/api-package)
