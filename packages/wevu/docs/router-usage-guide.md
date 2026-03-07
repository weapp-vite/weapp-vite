# wevu/router 使用指南（Vue Router 心智对齐）

本文档聚焦 `wevu/router` 最近新增和升级的能力，帮助你以更接近 Vue Router 4 的方式组织小程序路由逻辑。

## 1. 快速示例

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
      name: 'legacy-home',
      path: '/pages/legacy/index',
      redirect: '/pages/home/index?from=legacy',
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

## 2. currentRoute：直接读取当前路由

`useRouter()` 返回对象现在内置 `currentRoute`，用于读取当前页面路由状态。

```ts
const router = useRouter()

console.log(router.currentRoute.path)
console.log(router.currentRoute.fullPath)
console.log(router.currentRoute.query)
```

`currentRoute` 会随着小程序路由生命周期（例如 `onShow` / `onRouteDone`）更新，无需手动维护快照。

## 3. resolve() 扩展字段

`router.resolve()` 返回 `RouteLocationNormalizedLoaded`，支持以下扩展字段（均为可选）：

- `href`: 解析后的完整目标地址（等价于 `fullPath`）
- `matched`: 命中的路由记录列表（当前实现为单记录）
- `redirectedFrom`: 重定向链路中的来源位置

```ts
const resolved = router.resolve({
  name: 'post-detail',
  params: { id: 1 },
  query: { preview: '1' },
})

console.log(resolved.href)
console.log(resolved.matched)
console.log(resolved.redirectedFrom)
```

## 4. paramsMode：命名路由参数校验策略

`paramsMode` 支持两种模式：

- `loose`（默认）：兼容模式。路径模板未消费的参数不会阻断导航。
- `strict`: 严格模式。未消费的参数会触发导航失败。

```ts
const router = useRouter({
  paramsMode: 'strict',
  namedRoutes: {
    'post-detail': '/pages/post/:id/index',
  },
})

// strict 模式下，extra 未被路径模板消费，会抛出失败
await router.push({
  name: 'post-detail',
  params: { id: 1, extra: 'unused' },
})
```

推荐：业务早期或迁移阶段使用 `loose`，稳定后切换为 `strict` 提前发现参数误传。

## 5. go / forward / back 行为约定

`wevu/router` 已支持：

- `back(delta?)`
- `go(delta)`
- `forward()`

其中：

- `go(<0)` 等价于回退 `back(Math.abs(delta))`
- `go(0)` 为 no-op
- 小程序原生不支持真正的前进栈控制，因此 `forward()` 会返回 `NavigationFailureType.aborted`

```ts
await router.go(-2) // 回退两层
await router.go(0) // 无动作

const result = await router.forward()
if (result && result.type === 4) {
  console.log('forward 不可用（平台限制）')
}
```

## 6. 推荐实践

- 优先使用 `wevu/router` 子入口，而不是直接使用原生 Router API。
- 将鉴权和页面可达性校验优先放在路由记录的 `beforeEnter` 中。
- 需要兼容历史路径时，使用路由记录 `redirect`，并结合 `redirectedFrom` 做埋点。
- 在核心路径使用 `paramsMode: 'strict'`，减少参数错配导致的隐性跳转问题。
