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

## 2.1 首屏导航模式

`createRouter()` 默认使用 `initialNavigationMode: 'eager'`。页面会先完成生命周期和首屏渲染，异步导航守卫在后台运行，因此不会因为网络鉴权或数据请求而白屏。守卫的 redirect、abort 和异常不会阻塞首次挂载；页面卸载后，迟到结果也不会重新触发生命周期或写入页面数据。

只有确实要求“守卫完成前不挂载页面”时才使用 blocking：

```ts
const router = createRouter({
  initialNavigationMode: 'blocking',
  initialNavigationTimeout: 10_000,
})
```

blocking 适合必须先完成的鉴权、租户选择或合规检查。默认超时为 `10_000ms`，超时后自动放行页面并输出稳定诊断 marker。普通网络数据预加载应在页面内使用 loading 或 skeleton 状态完成，不建议用 blocking 延迟首屏。

blocking 首屏守卫返回重定向目标时，会解析命名路由与 query，并通过宿主 `redirectTo` 进入普通页面，或通过 `switchTab` 进入 tabBar 页面；原始页面不会挂载。该行为只作用于 blocking 首屏导航，eager 模式仍先挂载原页面。

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

### 3.2 从页面生成命名路由

启用 `weapp.autoRoutes` 后，在已被页面发现机制识别的 Vue 页面中声明稳定名称；路径仍由现有主包、分包和 scope 规则决定，不需要再维护一份路径表。

```vue
<script setup lang="ts">
import { definePage } from 'wevu/router'

definePage({
  name: 'home',
  meta: { title: '首页', requiresAuth: false },
})
</script>
```

在 App 初始化模块中使用生成的数据：

```ts
import { createRouter } from 'wevu/router'
import { routes } from 'wevu/router/auto-routes'

const router = createRouter({ routes })
router.beforeEach((to, from) => {
  if (to?.name === 'home') {
    console.log(to.meta.title) // string
    console.log(to.meta.requiresAuth) // boolean
  }
  // 初始状态和未声明名称的页面仍可能没有 name/meta。
  console.log(from.name)
})

await router.push({ name: 'home' })
```

- `weapp-vite/auto-routes` 仍导出原有的 `pages / entries / subPackages`；新入口只导出具名 `routes`，不导入或执行页面模块。
- `definePage` 必须显式从 `wevu/router` 导入，允许导入别名；每个页面只能有一个顶层调用。`name` 是应用内唯一的非空静态字符串，`meta` 是可选的静态 JSON 对象，省略时生成 `{}`。
- 支持 SFC 内联脚本，以及 `<script src>` / `<script setup src>` 引用的外部脚本；声明属于引用脚本的页面，路由路径始终来自页面的最终注册位置，而不是外部脚本所在目录。`src` 可使用相对路径、`resolve.alias` 或包导出，`prepare` 同样解析；外部脚本中的相对模块引用仍以原脚本目录为准。
- 启用 Web 目标时，同一路由的多个候选源文件如含页面声明，`name/meta` 必须一致；冲突会报告候选文件，而不会为两个目标猜选不同的命名映射。未声明的旧页面保持原有发现规则。
- 支持字符串、有限数字、布尔值、`null`、数组和嵌套对象；不支持导入常量、变量引用、函数调用、展开、计算键、访问器、`undefined` 或手写 `path`。重复名称及非法声明会报告源文件位置。
- 未调用 `definePage` 的页面仍正常注册并可按路径导航，但不会得到自动名称。`meta.title` 只是业务数据，不会改写宿主标题；标题仍用 `definePageJson` 配置，可以与 `definePageMeta` 共存。
- 运行 `weapp-vite prepare` 后，将 `.weapp-vite/typed-router.d.ts` 纳入项目 TypeScript 的 `include`。`dev/build` 使用同一生成链路；移动页面、增删声明和仅修改 `meta` 都会更新数据与类型。
- Web 开发模式下，命名路由元信息或页面拓扑变化会重新加载应用入口，让挂载中的 Router 使用新快照；不会保留该次更新前的页面状态。未改变路由声明的普通源码修改仍走原有 HMR。
- 生成的 `WevuNamedRouteMap` 让 `createRouter/useRouter/useRoute`、守卫和导航 API 按名称关联 `meta`；值会结构化拓宽，不固定为初始字面量。未知名称、混用 `name` 与 `path/fullPath`、同名动态替换时不匹配的路径或 `meta` 会产生类型错误；不推导页面精确 `params/query`。
- 没有命名映射时保持原有宽类型。确需运行时任意名称时，在创建和读取 Router 时一致使用 `createRouter<WevuBroadRouteMap>()`、`useRouter<WevuBroadRouteMap>()`、`useRoute<WevuBroadRouteMap>()`；这会主动放弃名称与元信息收窄。

同一声明和生成入口也适用于仓库的 Web 构建目标；这不是任意 Vue Router 工程可直接使用的插件。

## 4. 核心能力

- `useRouter()`：获取当前已创建的路由实例
- `createRouter()`：创建带守卫、失败分类的高阶路由器
- `useRoute()`：读取当前路由快照
- `resolveRouteLocation()`：预解析目标位置
- `parseQuery()` / `stringifyQuery()`：query 处理工具
- `createNavigationFailure()` / `isNavigationFailure()`：失败对象与判定
- `NavigationFailureType`：失败类别枚举

## 5. 常见心智

### 5.1 路径与稳定名称

```ts
await router.push('/pages/post/1/index?preview=0')
```

真实页面路径仍决定分包、注册和宿主跳转。跨目录重构频繁的业务入口可以用上面的稳定名称导航；没有声明名称的页面继续使用路径。

### 5.2 守卫用于统一前置判断

```ts
import { createRouter } from 'wevu/router'

const router = createRouter()
router.beforeEach((to) => {
  if (to?.path.startsWith('/pages/private/') && !isLoggedIn()) {
    return '/pages/login/index'
  }
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
- 自动名称用于解除业务调用与物理目录的耦合，不替代小程序真实路径和已有页面发现机制

## 7. 速查表

| 需求                    | 建议 API                            |
| ----------------------- | ----------------------------------- |
| 获取高阶 router 实例    | `useRouter()` from `wevu/router`    |
| 获取当前 route 快照     | `useRoute()`                        |
| 获取页面路径语义 Router | `useNativePageRouter()` from `wevu` |
| 获取组件路径语义 Router | `useNativeRouter()` from `wevu`     |

## 8. 相关页面

- [Wevu Router API 完整参考](/wevu/api/router)
- [wevu/api/setup-context](/wevu/api/setup-context)
- [wevu/api/runtime-bridge](/wevu/api/runtime-bridge)
- [wevu/api-package](/wevu/api-package)
