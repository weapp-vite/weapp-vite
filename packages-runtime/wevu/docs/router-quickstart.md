# wevu/router 快速上手

本文档提供一套可直接落地的最小配置，帮助你在小程序项目里快速使用 `wevu/router`。

## 自动路由：页面元信息与生成入口

在 `weapp-vite.config.ts` 开启 `weapp.autoRoutes`，然后在被现有页面扫描识别的页面中增强既有页面元信息：

```vue
<script setup lang="ts">
definePageMeta({
  layout: false,
  route: {
    name: 'home',
    meta: { title: '首页', requiresAuth: false },
  },
})
</script>
```

App 初始化时读取纯数据路由表：

```ts
import { createRouter, useRoute } from 'wevu/router'
import { routes } from 'wevu/router/auto-routes'

const router = createRouter({ routes })
router.beforeEach((to) => {
  if (to?.name === 'home') {
    console.log(to.meta.title, to.meta.requiresAuth)
  }
})
await router.push({ name: 'home' })

// 在页面同步 setup 中读取。
const route = useRoute()
if (route.name === 'home') {
  console.log(route.meta.title) // string，而不是固定的“首页”字面量
}
```

运行 `weapp-vite prepare`，并把 `.weapp-vite/typed-router.d.ts` 纳入 TypeScript `include`。生成的 `WevuNamedRouteMap` 同时关联名称、最终路径与结构化拓宽的 `meta`；dev/build 复用同一声明生成链路。分包和 scope 仍由原配置控制，移动页面不需要修改按名称导航的调用。

升级后，旧协议留下的持久化命名记录会随缓存 schema 自动失效并重新扫描；不需要手动清理缓存。

`definePageMeta()` 是既有 `<script setup>` 编译宏，全局、无导入调用是规范写法；也可以从 `wevu` 具名导入并使用别名。不要从 `wevu/router` 导入。编译器会区分宏绑定与同名遮蔽，并在支持的编译路径中保留错误源位置。命名路由只是该宏新增的 `route` 能力，不会恢复历史 `definePage` 页面注册宏。

`route` 是可选专用命名空间；存在时必须包含应用内唯一的非空静态 `name`，可选 `meta` 必须是有限静态 JSON 对象，省略时生成 `{}`。不接受导入常量、函数、展开、计算键、`undefined` 或 `path`。省略整个 `route` 时不会生成命名路由。

顶层 `layout` 仍由原有 layout 编译链路处理；Vue SFC 的 `layout.props` 对象与键名需要静态可分析，但值可以保留响应式表达式。其他顶层 `PageMeta` 字段继续保持原有语义，均不会流入 `route.meta`。`route.meta` 只是守卫和业务代码的数据：其中的 `title` 或 `layout` 不会设置宿主标题或页面壳；宿主页面 JSON 使用 `definePageJson()`，组件选项使用 `defineOptions()`。

SFC 内联脚本和 `<script src>` / `<script setup src>` 的外部脚本均可声明。外部脚本的声明仍属于引用它的页面；移动页面时名称不变，路径随页面最终注册位置更新。`src` 支持相对路径、`resolve.alias` 和包导出，`prepare` 也会解析；外部脚本内的相对模块引用仍以原脚本目录为准。

未声明 `route` 的页面仍按路径注册；初始路由及未命名路由的 `name/meta` 仍可能缺省。旧 `weapp-vite/auto-routes` 的 `pages/entries/subPackages` 保持不变。该功能也适用于 weapp-vite 的 Web 目标，不是通用 Vue Router 插件。

Web 开发模式会在路由声明或页面拓扑变化时重新加载应用入口，更新挂载中的 Router 快照；此次更新不保留页面状态。普通源码修改若未改变路由声明，仍使用原有 HMR。

有生成映射时，未知名称、混用名称与路径、不匹配的同名动态记录会被拒绝；不会推导精确 `params/query`。以下手写记录示例适用于没有生成命名映射的兼容模式。确需任意运行时名称时，显式使用 `createRouter<WevuBroadRouteMap>()`，并让 `useRouter/useRoute` 使用相同泛型，避免把动态路由误认为静态声明。

## 1. 初始化路由器

```ts
import { createRouter, useRouter } from 'wevu/router'

createRouter({
  paramsMode: 'strict',
  // 首屏默认 eager；只有必须先完成守卫时才改为 blocking
  initialNavigationMode: 'eager',
  routes: [
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

const router = useRouter()
```

在 `app.vue` 的 `<script setup>` 里调用一次 `createRouter()`，不要放进 `onLaunch`。App 没有页面级 `this.router` 时会用 `wx` / `my` / `tt`。未传 `tabBarEntries` 时读取宿主 tabBar，这些路径走 `switchTab`。

### 首屏导航模式

`initialNavigationMode` 默认值为 `'eager'`。页面会先挂载并渲染，首屏守卫异步运行，不会因鉴权请求或其他慢操作造成白屏。若业务必须在页面挂载前完成鉴权、租户选择等判断，显式配置 `initialNavigationMode: 'blocking'`：

```ts
createRouter({
  initialNavigationMode: 'blocking',
  initialNavigationTimeout: 10_000,
})
```

`initialNavigationTimeout` 只控制 blocking 模式，默认 `10_000ms`，超时后放行页面并输出诊断 marker。数据预加载建议由页面显示 loading 或 skeleton，不要用 blocking 代替。

blocking 首屏守卫返回重定向目标时，会解析命名路由与 query，并通过宿主 `redirectTo` 进入普通页面，或通过 `switchTab` 进入 tabBar 页面；原始页面不会挂载。该行为只作用于 blocking 首屏导航，eager 模式仍先挂载原页面。

如果你希望沿用 Vue Router 的树状写法，也可以声明 `children`（会在内部展平为可匹配记录）：

```ts
createRouter({
  routes: [
    {
      name: 'home',
      path: '/pages/home',
      children: [
        {
          name: 'home-detail',
          path: 'detail/:id',
        },
      ],
    },
  ],
})

const router = useRouter()
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
console.log(router.options.routes)
console.log(router.options.namedRoutes)
```

其中 `routes` 是推荐入口，`namedRoutes` 保留用于兼容旧写法。
`router.options` 是初始化快照（运行时冻结，非响应式），不会随着 `addRoute/removeRoute/clearRoutes` 实时变化；动态路由请使用 `router.getRoutes()` 读取当前状态。

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
  alias: '/pages/legacy/alias-index',
  redirect: '/pages/home/index?from=legacy',
})

const removeChild = router.addRoute('home', {
  name: 'home-settings',
  path: 'settings',
})

console.log(router.hasRoute('legacy-home'))
console.log(router.getRoutes())

remove()
removeChild()
router.removeRoute('legacy-home')
router.clearRoutes()
```

说明：

- `addRoute()` 若遇到同名路由，会覆盖旧记录并自动清理旧记录下的子路由链。
- 初始化阶段如果 `routes` 与 `namedRoutes` 出现同名记录，会告警提示“后者覆盖前者”，并带上来源与路径变化信息（如 `routes:/a -> namedRoutes:/b`）。
- 初始化时若路由记录存在空 `name/path`、重复 `alias` 或循环 `children` 引用，会输出告警并跳过无效部分，避免隐式异常。
- `addRoute()` 对根记录采用严格校验：若缺失 `name/path` 或存在循环 `children` 引用会直接抛错，避免运行时写入不完整路由。

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
