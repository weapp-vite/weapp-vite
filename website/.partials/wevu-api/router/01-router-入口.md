## Router 入口

### `<RouterLink>` / `<router-link>` {#routerlink}

<!-- api-reference-details -->

**类型签名：** Wevu 不导出 `RouterLink` 组件。

**运行时说明：** 小程序没有 Web history 链接组件。模板内使用原生 `<navigator>`，命令式场景使用 `router.push()`。

**Vue Router 差异：** 不提供 `RouterView`、`RouterLink` 或 Web history；导航由宿主页面栈和 tabBar 决定。

**示例：** 见 [本组示例](/wevu/api/router#example-router-entry)。

### `createRouter()` {#createrouter}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu/router')['createRouter']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 不选择 Web History 实现；配置重点是路由记录、tabBar、params 策略和宿主导航失败处理。

**示例：** 见 [本组示例](/wevu/api/router#example-router-entry)。

创建并注册默认 Router。选项支持路由记录、tabBar 路径、params 模式、重定向上限、query codec、首屏导航模式和导航失败策略。

首屏导航默认使用 `initialNavigationMode: 'eager'`：页面先挂载并渲染，异步守卫在后台完成。需要在守卫完成前阻止首屏（例如必须先完成鉴权并决定是否允许进入）时，显式设置 `initialNavigationMode: 'blocking'`。blocking 模式可通过 `initialNavigationTimeout` 设置最大等待时间，默认 `10_000ms`，超时后放行页面并输出诊断 marker；该超时配置对 eager 模式没有门控作用。

### `useRouter()` {#userouter}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu/router')['useRouter']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 调用形式接近 Vue Router，但导航最终映射到 `navigateTo`、`redirectTo`、`switchTab`、`reLaunch` 或 `navigateBack`，受页面栈和 tabBar 约束。

**示例：** 见 [本组示例](/wevu/api/router#example-router-entry)。

读取当前已创建的 Router；调用前必须先执行 `createRouter()`。

### `useRoute()` {#useroute}

<!-- api-reference-details -->

**类型签名：** `typeof import('wevu/router')['useRoute']`

**运行时说明：** 解析和守卫在 JavaScript 层执行，真正跳转仍由小程序 Router 完成，因此页面栈、tabBar 和宿主失败回调是最终边界。

**Vue Router 差异：** 返回值随小程序页面生命周期和导航完成事件同步，不依赖浏览器 URL/history 监听。

**示例：** 见 [本组示例](/wevu/api/router#example-router-entry)。

在 `setup()` 同步阶段读取只读的当前路由状态，并随页面生命周期和导航完成事件更新。

### `definePage()` {#definepage}

<!-- api-reference-details -->

**类型签名：** `definePage(declaration: StaticPageDeclaration): void`

**运行时说明：** 这是从 `wevu/router` 显式导入的编译宏，不是运行时注册函数。只允许在已识别页面中顶层调用一次，以静态 `name` 和可选 JSON 对象 `meta` 生成命名路由；省略元信息时生成 `{}`。名称必须全局唯一，路径由现有页面发现决定；导入别名受支持，非法表达式会在构建时报告源位置。调用会被编译擦除，未经编译直接执行会抛错。

**Vue Router 差异：** 宏不接受 `path`、动态表达式或路由 DSL，也不自动设置页面标题；`definePageJson` 和 `definePageMeta` 保留各自职责。

**示例：** 见 [本组示例](/wevu/api/router#example-router-entry)。

### `wevu/router/auto-routes` {#auto-routes}

**类型签名：** `routes: WevuAutoRoutes`；`WevuAutoRoutes` 从此子入口以 `import type` 导入。

**运行时说明：** 启用 `weapp.autoRoutes` 后，该子入口具名导出纯数据 `routes`，没有默认导出，也不会提前加载页面。使用 `createRouter({ routes })` 安装记录；在 weapp-vite 之外加载实体模块会抛错，不会静默返回空表。原有 `weapp-vite/auto-routes` 的 `pages/entries/subPackages` 不变。

**Vue Router 差异：** 该入口适用于 weapp-vite 的小程序和 Web 构建目标，不是通用 Vue Router 插件。

**示例：** 见 [本组示例](/wevu/api/router#example-router-entry)。

<span id="router-examples"></span>

### 本组示例 {#example-router-entry}

App 初始化阶段只创建一个 Router，页面在同步 setup 中读取它。

```ts
import { createRouter, useRoute, useRouter } from 'wevu/router'

createRouter({
  routes: [{ name: 'home', path: '/pages/home/index' }],
  tabBarEntries: ['/pages/home/index'],
})

const router = useRouter()
const route = useRoute()
console.log(router.currentRoute, route.fullPath)
```

自动路由的页面声明和 App 初始化分别写在对应源文件中：

```vue
<script setup lang="ts">
import { definePage } from 'wevu/router'

definePage({ name: 'home', meta: { title: '首页', requiresAuth: false } })
</script>
```

```ts
import { createRouter } from 'wevu/router'
import { routes } from 'wevu/router/auto-routes'

const router = createRouter({ routes })
await router.push({ name: 'home' })
```

运行 `weapp-vite prepare` 后，将 `.weapp-vite/typed-router.d.ts` 纳入 TypeScript 项目。名称关联、元信息拓宽和动态兼容模式见 [命名路由类型](/wevu/api/router-types#type-wevunamedroutemap)。
