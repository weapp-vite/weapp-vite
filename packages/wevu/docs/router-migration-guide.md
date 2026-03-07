# wevu/router 迁移指南

本文档用于把已有的小程序路由调用迁移到 `wevu/router`，并尽量保持 Vue Router 的心智一致。

## 1. 迁移目标

- 统一从 `wevu/router` 获取路由能力
- 从“字符串路径拼接”迁移到“命名路由 + params”
- 让守卫逻辑从分散判断迁移到 `beforeEnter` / 全局守卫
- 通过 `paramsMode: 'strict'` 发现历史参数问题

## 2. API 对照表

| 旧写法（原生/分散）              | 新写法（wevu/router）                          |
| -------------------------------- | ---------------------------------------------- |
| `router.navigateTo({ url })`     | `router.push(to)`                              |
| `router.redirectTo({ url })`     | `router.replace(to)`                           |
| `router.navigateBack({ delta })` | `router.back(delta)` / `router.go(-delta)`     |
| 无统一前进能力                   | `router.forward()`（平台限制下返回失败对象）   |
| 手写 query/params 拼接           | `name + params + query`                        |
| 手写前置判断                     | `beforeEach` / `beforeResolve` / `beforeEnter` |

## 3. 推荐迁移步骤

### 第一步：先接管入口

```ts
import { useRouter } from 'wevu/router'

const router = useRouter({
  paramsMode: 'loose',
})
```

先用 `loose` 兼容模式稳定接管，避免一次性暴露所有历史问题。

### 第二步：补命名路由

```ts
const router = useRouter({
  routes: [
    { name: 'home', path: '/pages/home/index' },
    { name: 'post-detail', path: '/pages/post/:id/index' },
  ],
})
```

把高频路径先改成命名路由，降低硬编码路径风险。

### 第三步：迁移守卫

```ts
const router = useRouter({
  routes: [
    {
      name: 'dashboard',
      path: '/pages/dashboard/index',
      beforeEnter: () => '/pages/login/index',
    },
  ],
})
```

把“路由级规则”放到 `beforeEnter`，把“全局规则”放到 `beforeEach/beforeResolve`。

### 第四步：切 strict

```ts
const router = useRouter({
  paramsMode: 'strict',
  routes: [
    { name: 'post-detail', path: '/pages/post/:id/index' },
  ],
})
```

切 `strict` 后，如果还存在多余参数，会得到明确失败提示，可逐步修正。

如果你已有历史配置，也可以继续使用 `namedRoutes`（对象 map/数组都支持）；推荐在迭代中逐步迁移到 `routes` 写法以对齐 Vue Router 心智。

当同时传入 `routes` 与 `namedRoutes` 且存在同名记录时，`namedRoutes` 会覆盖前者，运行时会输出一次告警，帮助你在迁移期排查配置冲突。

兼容策略建议：

1. 新增路由统一写到 `routes`。
2. 历史模块保留 `namedRoutes`，按业务域逐步迁移。
3. 每次迁移后观察冲突告警，确保无同名覆盖残留。
4. 清理完成后移除 `namedRoutes` 配置入口。

## 4. 常见迁移问题

### Q1：为什么 `forward()` 失败？

小程序路由栈不支持标准前进语义。`wevu/router` 会返回 `NavigationFailureType.aborted`，这是预期行为。

### Q2：如何定位重定向链路？

可以在 `afterEach` 里读取 `to.redirectedFrom`，用于日志和埋点。

### Q3：`resolve()` 有什么额外价值？

`resolve()` 提供 `href/matched/redirectedFrom`，方便你在真正跳转前做预检查和调试。

## 5. 验收清单

- 所有业务跳转都走 `wevu/router` 子入口
- 高频路径已迁移到 `routes`（兼容阶段允许 `namedRoutes`）
- 守卫逻辑不再分散在业务代码里
- 已在核心流程启用 `paramsMode: 'strict'`
- 已补充失败场景测试（重复跳转、无效参数、重定向链路）
