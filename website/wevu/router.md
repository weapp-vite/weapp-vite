---
title: wevu/router
description: wevu/router 子路径文档，介绍命名路由编译宏、自动路由、守卫、失败分类、滚动恢复与小程序环境下的边界。
keywords:
  - wevu/router
  - definePage
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

启用 `weapp.autoRoutes` 后，在已被页面发现机制识别的 Vue 页面中通过专用的 `definePage()` 声明稳定名称；路径仍由现有主包、分包和 scope 规则决定，不需要再维护一份路径表。页面元信息/layout、命名路由和宿主页面配置各有独立宏：

```vue
<script setup lang="ts">
definePageMeta({
  layout: false,
  custom: { section: 'home' },
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
- 升级后，旧协议留下的持久化命名记录会随缓存 schema 自动失效并重新扫描；不需要手动删除缓存文件。
- 全局、未绑定的 `definePage()` 是规范写法；需要显式绑定时，从 `wevu/router` 具名导入，也可以使用别名。它必须在页面脚本顶层直接调用，每个页面最多一次；编译后会被擦除，不存在可动态调用的运行时实现。
- 参数必须包含应用内唯一的非空静态 `name`；`meta` 是可选的有限静态 JSON 对象，省略时生成 `{}`。不接受 `path` 或顶层 `layout`。
- `definePageMeta()` 继续负责原有页面元信息和 layout。在 Vue SFC 中，`layout.props` 对象与键名需要静态可分析，值可以保留响应式表达式。它可以和 `definePage()` 各声明一次，互不覆盖。
- `definePageMeta({ route: ... })` 不会生成命名路由。`definePage()` 是预期使用的独立路由声明，与已移除的历史页面注册能力职责不同；旧名 `definePageRoute` 不提供兼容别名。
- `definePage({ name, meta })` 参数中的 `meta` 是守卫和业务代码读取的数据。它里面的 `title` 或 `layout` 不会设置宿主标题或选择页面壳；宿主 JSON 使用 `definePageJson()`，组件选项使用 `defineOptions()`。
- 支持 SFC 内联脚本，以及 `<script src>` / `<script setup src>` 引用的外部脚本；声明属于引用脚本的页面，路由路径始终来自页面的最终注册位置，而不是外部脚本所在目录。`src` 可使用相对路径、`resolve.alias` 或包导出，`prepare` 同样解析；外部脚本中的相对模块引用仍以原脚本目录为准。
- 启用 Web 目标时，同一路由的多个候选源文件如含 `definePage()` 声明，`name/meta` 必须一致；冲突会报告候选文件，而不会为两个目标猜选不同的命名映射。未声明的旧页面保持原有发现规则。
- `meta` 支持字符串、有限数字、布尔值、`null`、数组和嵌套对象；不支持导入常量、变量引用、函数调用、展开、计算键、访问器或 `undefined`。重复名称及非法声明会报告源文件位置。
- 运行 `weapp-vite prepare` 后，将 `.weapp-vite/typed-router.d.ts` 纳入项目 TypeScript 的 `include`。`dev/build` 使用同一生成链路；移动页面、增删 `definePage()` 和仅修改 `meta` 都会更新数据与类型。
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
- `createScrollRestoration()`：为 router 显式创建滚动快照会话
- `useScrollRestoration()` / `usePageScrollRestoration()` / `useScrollViewRestoration()`：在同步 setup 中注册自定义、页面或容器恢复

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

### 5.4 按需恢复滚动位置 {#scroll-restoration}

滚动恢复是显式启用的能力，不是 `createRouter()` 的默认行为，也不是 Vue Router 的 `scrollBehavior`。先在 App 初始化模块中、任何导航发生前创建一次会话：

```ts
import { createRouter, createScrollRestoration } from 'wevu/router'

export const router = createRouter()
export const scrollRestoration = createScrollRestoration({ router })
```

同一个 router 只能有一个未释放的 controller。页面/组件的组合式函数必须在同步 `setup()` 或 `<script setup>` 中调用；默认使用当前 router 的 controller，多 router 场景显式传入 `{ controller: scrollRestoration }`。不要每进一个页面就重新创建会话。

#### `scroll-view`：显式绑定容器

WebView 和 Skyline 都可使用属性控制的 `scroll-view`。把返回的 ref 解构为顶层绑定，同时绑定两个位置属性和 `scroll` 事件：

```vue
<script setup lang="ts">
import { useScrollViewRestoration } from 'wevu/router'

const { scrollTop, scrollLeft, onScroll } = useScrollViewRestoration({
  id: 'catalog',
})
</script>

<template>
  <scroll-view
    scroll-y
    style="height: 400px"
    :scroll-top="scrollTop"
    :scroll-left="scrollLeft"
    @scroll="onScroll"
  >
    <view style="height: 1600px">
      商品列表内容
    </view>
  </scroll-view>
</template>
```

滚动区必须有明确尺寸，内容也必须足够长；横向滚动还需启用 `scroll-x` 并提供超出容器的内容宽度。`onScroll` 只更新普通内存缓存，不会在每次滚动时改写 ref 或触发 `setData`。恢复时会先提交当前位置基线，再提交目标值，因此重复恢复相同目标也能生效。

不要在同一容器上同时使用 `scroll-into-view`：宿主会优先执行它，而不是这里的 `scroll-top/scroll-left`。需要锚点定位或虚拟列表时，用自定义适配器保持唯一滚动控制方。

#### WebView 页面级滚动

如果滚动的是整个 WebView 页面，在页面同步 setup 中注册：

```ts
import { usePageScrollRestoration } from 'wevu/router'

const handle = usePageScrollRestoration({ id: 'page' })
```

它缓存 `onPageScroll` 的位置，并通过 `wx.pageScrollTo({ scrollTop, duration: 0 })` 恢复。Skyline 不提供这里假定的页面级滚动容器，不能使用此 helper，应改用显式 `scroll-view`。内置适配器没有快照时恢复到 `0`。

#### 异步内容：业务就绪后再恢复

自动恢复只等待页面/组件 ready、原生路由完成、首屏守卫结算以及实际宿主渲染提交，不会猜测接口、图片尺寸或虚拟列表何时稳定。此类页面应设置 `manual: true`，先在同步 setup 中注册，再在业务内容准备完成后调用 `handle.scroll()`：

```ts
import { onReady, ref } from 'wevu'
import { useScrollViewRestoration } from 'wevu/router'
import { loadRows } from '@/services/catalog'

const rows = ref<string[]>([])
const handle = useScrollViewRestoration({ id: 'catalog', manual: true })
const { scrollTop, scrollLeft, onScroll } = handle

onReady(async () => {
  rows.value = await loadRows()
  await handle.scroll()
})
```

这里的 `loadRows` 是业务自己的数据加载函数；模板仍按上例绑定三个解构值，并渲染 `rows`。`scroll()` 会等待本轮实际宿主提交，但图片解码、后续分页等仍需业务等待。目标超出当前内容范围时会被宿主裁到可滚动范围，不会等待内容变长后自动重试。调用方应处理 `scroll()` 的拒绝；返回 `false` 表示已跳过或恢复已失效，并非错误，也不代表目标像素已到达。

#### 会话、原生保留页与清理

- 默认快照索引是 `route.fullPath + id`（内部按两层 key 存储），`id` 默认为 `'default'`。不同 query 默认隔离，例如 `?category=a` 与 `?category=b`；覆盖 `key` 为 `route => route.path` 会主动合并这些位置。key 在注册绑定归属页面时确定，不会持续跟踪响应式筛选条件。
- 同一原生页面内相同 `key/id` 只能注册一次；多个列表使用不同 `id`。跨页面实例使用相同 `key/id` 会共享快照，必须保持相同数据格式。
- 快照只存在 controller 的会话内存中，可跨原生页面销毁、同一运行会话内的 `reLaunch` 保留；冷启动、应用重新加载或 `dispose()` 后不会保留，不写入 storage。
- 自动恢复只作用于本次原生路由新建的页面实例。返回栈中保留页、切回已保留 tab、应用回到前台时，位置仍由原生宿主维护，不会再次回放快照。保留页若由业务重建了内容，可在内容就绪后手动 `scroll()`。
- 微信原生自动关联要求基础库 **3.5.5+**，以及 `BeforeAppRoute`、`AppRoute`、`AppRouteDone`、`BeforePageUnload` 四组 `on/off` API；事件必须携带字符串 `routeEventId`。低版本或缺少能力时 `controller.automatic === false`，仍可捕获并手动 `scroll()`，不能把 `onShow` 当作路由完成通知。`manual: true` 也会令当前 handle 的 `automatic` 为 `false`。
- 部分原生同路径 `reLaunch` 的 `AppRouteDone.routeEventId` 为空（已在基础库 3.17.2 观察到）。仅当目标是本次已确认的新页面，且完成事件的 `webviewId`、路径、导航类型全部匹配时才接受；不同的非空 ID、旧页面和保留页不会走此兼容路径。恢复上下文保留前置路由事件的 ID。
- 仓库 Web/headless 宿主通过显式路由事件契约接入，不伪装成微信高版本 SDK。此能力不模拟浏览器 viewport、DOM 查询、history 或 Vue Router 的 `savedPosition`。
- headless 的滚动范围计算只覆盖显式 inline `px` 视口和单个内容盒，不具备完整 CSS 布局能力；仅靠样式表、自动尺寸或复杂布局得到的位置，必须在实际浏览器或微信 IDE 中验收。headless 通过不等于真实 WebView/Skyline 渲染验证通过。

`handle.clear()` 只清除当前 `key/id` 的快照；`controller.clear(key)` 清除该 key 下全部 id，`controller.clear()` 清除整个会话。它们让相关待完成恢复失效，但不注销注册、不改变当前滚动位置；之后的正常隐藏/卸载仍可捕获新快照。

`handle.stop()` 注销当前注册并使待完成恢复失效，保留已有快照，**不会额外捕获**；所以 `handle.clear(); handle.stop()` 不会把刚清除的位置写回来。正常生命周期销毁仍会在停止注册前捕获。应用级 `controller.dispose()` 则移除宿主监听、注销所有注册、取消待完成恢复并清空会话。

自定义列表使用 `useScrollRestoration()`：`capture` 必须同步返回独立对象或 `null`（清除），不能返回 Promise 或仍会被修改的响应式对象；异步 `restore` 每次 `await` 后、写宿主前都必须检查 `context.isActive()`。详见 [滚动恢复 API 与自定义示例](/wevu/api/router#scroll-restoration) 和 [类型参考](/wevu/api/router-types#scroll-restoration-types)。

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
