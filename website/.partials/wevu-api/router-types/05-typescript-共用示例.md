## TypeScript 共用示例 {#router-type-examples}

类型应从 `wevu/router` 以 type-only 方式导入，路由记录和守卫上下文可以共同约束业务封装。

```ts
import type { NavigationGuard, RouteLocationRaw, RouteRecordInput } from 'wevu/router'

const routes: RouteRecordInput[] = [
  { name: 'detail', path: '/pages/detail/index', meta: { requiresLogin: true } },
]

const target: RouteLocationRaw = { name: 'detail', params: { id: 42 } }
const authGuard: NavigationGuard = to =>
  to?.meta?.requiresLogin ? { name: 'login' } : true

export { authGuard, routes, target }
```
