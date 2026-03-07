# wevu/router 快速上手

本文档提供一套可直接落地的最小配置，帮助你在小程序项目里快速使用 `wevu/router`。

## 1. 初始化路由器

```ts
import { useRouter } from 'wevu/router'

const router = useRouter({
  paramsMode: 'strict',
  namedRoutes: [
    {
      name: 'home',
      path: '/pages/home/index',
      meta: { requiresAuth: true },
    },
    {
      name: 'post-detail',
      path: '/pages/post/:id/index',
      beforeEnter: (to) => {
        if (to?.query.preview === '1') {
          return '/pages/preview/index'
        }
      },
    },
  ],
})
```

如果你有“应用启动后再执行业务跳转”的流程，可以先等待：

```ts
await router.isReady()
```

## 2. 使用 currentRoute

```ts
console.log(router.currentRoute.path)
console.log(router.currentRoute.fullPath)
console.log(router.currentRoute.query)
```

`currentRoute` 与页面路由生命周期同步更新，适合页面状态展示和调试。

如果你需要读取初始化配置，也可以使用：

```ts
console.log(router.options.paramsMode)
console.log(router.options.namedRoutes)
```

## 3. 命名路由导航

```ts
await router.push({
  name: 'post-detail',
  params: { id: 1 },
  query: { from: 'home' },
})
```

`paramsMode: 'strict'` 下，未被路径模板消费的参数会触发失败，帮助你尽早发现参数误传。

## 4. resolve() 调试信息

```ts
const resolved = router.resolve({
  name: 'post-detail',
  params: { id: 1 },
})

console.log(resolved.href)
console.log(resolved.matched)
console.log(resolved.redirectedFrom)
```

`href/matched/redirectedFrom` 是对齐 Vue Router 心智的扩展调试字段。

## 5. 路由记录管理

```ts
const remove = router.addRoute({
  name: 'legacy-home',
  path: '/pages/legacy/index',
  redirect: '/pages/home/index?from=legacy',
})

console.log(router.hasRoute('legacy-home'))
console.log(router.getRoutes())

remove()
router.removeRoute('legacy-home')
router.clearRoutes()
```

## 6. 导航 API 行为

```ts
await router.back(1)
await router.go(-2)
await router.go(0)

const forwardResult = await router.forward()
```

说明：

- `go(<0)` 会复用 `back()`
- `go(0)` 是 no-op
- 小程序不支持真正前进栈，`forward()` 会返回 `NavigationFailureType.aborted`
