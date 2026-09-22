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

**类型签名：** `typeof import('wevu/router')['definePage']`

**编译期说明：** 这是页面 `<script setup>` 的顶层直接声明，编译后会被擦除，不提供可动态调用的运行时实现。规范写法是直接使用全局宏；需要显式绑定时，可以从 `wevu/router` 具名导入或使用别名。

**Vue Router 差异：** 这是 weapp-vite 页面扫描与自动路由生成使用的 Wevu 编译宏，不是 Vue Router API。它是当前独立的路由声明宏，与已移除的历史页面注册能力职责不同；旧名 `definePageRoute` 不提供兼容别名。

**示例：** 见 [本组示例](/wevu/api/router#example-router-entry)。

每个页面最多声明一次。参数只接受应用内唯一的非空静态 `name` 和可选的有限静态 JSON 对象 `meta`；不接受 `path`、顶层 `layout`、展开、计算键、动态引用或函数调用。

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

自动路由的页面路由、layout 和宿主配置分别写在对应宏中：

```vue
<script setup lang="ts">
definePageMeta({
  layout: false,
})

definePage({
  name: 'home',
  meta: { title: '首页', requiresAuth: false },
})

definePageJson({
  navigationBarTitleText: '宿主首页',
})
</script>
```

这里使用的是全局 `definePage()` 宏；如需显式导入或别名，只能来自 `wevu/router`。`definePageMeta()` 继续负责原有页面元信息和 layout，`definePageJson()` 负责宿主配置。`definePage({ name, meta })` 参数中的 `meta.title` 或 `meta.layout` 只作为路由业务数据，不会替代后两者。

```ts
import { createRouter } from 'wevu/router'
import { routes } from 'wevu/router/auto-routes'

const router = createRouter({ routes })
await router.push({ name: 'home' })
```

运行 `weapp-vite prepare` 后，将 `.weapp-vite/typed-router.d.ts` 纳入 TypeScript 项目。名称关联、元信息拓宽和动态兼容模式见 [命名路由类型](/wevu/api/router-types#type-wevunamedroutemap)。
