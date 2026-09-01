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
