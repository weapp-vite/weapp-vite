---
title: Wevu Router 类型
description: wevu/router 的公开 TypeScript 类型，覆盖位置、参数、守卫、失败、路由记录和小程序宿主 Router。
outline:
  level: [2, 2]
keywords:
  - wevu/router
  - TypeScript
  - RouteLocation
  - NavigationGuard
  - RouterNavigation
---

# Wevu Router 类型

以下类型均从 `wevu/router` 导出。运行时函数和 Router 实例方法见 [Wevu Router API](/wevu/api/router)。

## 命名路由类型

下面的泛型路由契约默认使用项目生成的 `WevuNamedRouteMap`。没有映射时保持原来的宽类型；其余章节中的位置、守卫和记录结构按该兼容模式展开。启用映射后，`RouterNavigation`、`UseRouterOptions`、位置、守卫、失败与路由记录类型都通过同一个 `TRouteMap` 关联。

### `WevuNamedRouteMap` {#type-wevunamedroutemap}

可由声明合并扩展的接口。`weapp-vite prepare/dev/build` 在现有 `.weapp-vite/typed-router.d.ts` 中生成它，不再创建第二份路由清单：

```ts
declare module 'wevu/router' {
  interface WevuNamedRouteMap {
    home: {
      path: '/pages/home/index'
      meta: { title: string, requiresAuth: boolean }
    }
    profile: {
      path: '/account/pages/profile/index'
      meta: { role: string, limits: { count: number }, tags: string[] }
    }
  }
}
```

字符串、数字与布尔值会拓宽；对象递归保留结构，数组保留元素类型联合，`null` 保留，空数组为 `unknown[]`。只有显式声明的页面进入映射，省略 `meta` 时为 `{}`。名称目标禁止混用 `path/fullPath`，未知名称和不匹配的同名动态替换记录会被拒绝；`params/query` 不做页面级精确推导。

```ts
import { useRoute, useRouter } from 'wevu/router'

const router = useRouter()
const route = useRoute()
if (route.name === 'profile') {
  console.log(route.meta.role, route.meta.limits.count)
}
router.beforeEach((to, from) => {
  if (to?.name === 'home') {
    console.log(to.meta.title)
  }
  if (from.name === 'profile') {
    console.log(from.meta.role)
  }
})
```

初始状态和未声明页面仍可能没有名称或元信息；守卫中的 `to` 也仍可能是 `undefined`。按名称缩小联合后才可读取对应字段，不应把所有路由的 `meta` 合并成一个大对象。

### `WevuBroadRouteMap` {#type-wevubroadroutemap}

显式选择任意字符串名称和 `RouteMeta` 的兼容模式。动态名称无法在构建时确定时，让 `createRouter<WevuBroadRouteMap>()`、`useRouter<WevuBroadRouteMap>()` 和 `useRoute<WevuBroadRouteMap>()` 一致使用该类型；这会放弃自动名称与元信息收窄。

### `WevuNamedRouteDefinition` {#type-wevunamedroutedefinition}

单个命名映射项的基本形状：`{ path: string; meta: RouteMeta }`。生成的页面项会把路径收窄为最终注册路径，并把元信息替换成对应结构。

### `WevuRouteName` {#type-wevuroutename}

`WevuRouteName<TRouteMap>` 得到已声明名称联合；空映射或 `WevuBroadRouteMap` 则返回 `string`，用于导航及动态记录管理。

### `WevuNamedRoutePath` {#type-wevunamedroutepath}

`WevuNamedRoutePath<TRouteMap, TName>` 得到指定名称的最终路径。分包、scope 与页面移动由生成链路处理，不需要业务手写这份映射。

### `WevuNamedRouteMeta` {#type-wevunamedroutemeta}

`WevuNamedRouteMeta<TRouteMap, TName>` 得到该名称对应的元信息结构，不包含其他页面的字段；兼容模式使用 `RouteMeta`。

### `WevuAutoRoute` {#type-wevuautoroute}

生成路由表中单条数据记录的类型：只包含关联的只读 `name/path/meta`，不携带页面组件或加载函数。数组类型 `WevuAutoRoutes` 从 `wevu/router/auto-routes` 导出。

### `RouteLocationNamedRaw` {#type-routelocationnamedraw}

`RouteLocationNamedRaw<TRouteMap, TName>` 表示名称目标，保留通用 query/params 输入，但排除 `path/fullPath`。兼容模式的普通 `RouteLocationRaw` 保持旧规则。

### `RouteLocationNormalizedByName` {#type-routelocationnormalizedbyname}

`RouteLocationNormalizedByName<TRouteMap, TName>` 关联规范化位置中的名称与元信息；`TName` 是联合时仍保留可辨识联合，不丢失两者关系。

### `RouterResolve` {#type-routerresolve}

`router.resolve` 的函数类型。严格模式下传入单个已知名称会得到该名称对应的位置；路径输入保留包含未命名状态的联合，兼容模式保持原有宽返回类型。

### `StaticPageDeclaration` {#type-staticpagedeclaration}

`definePage()` 经编译器提取后的内部结构：必填 `name: string` 与可选 `meta: Record<string, StaticRouteValue>`。`StaticPageDeclaration` 保留为编译器与路由生成链路之间的纯 DTO；业务页面直接声明 `{ name, meta }`，TypeScript 约束值的形状，编译器另行检查静态表达式、顶层位置、页面归属与名称唯一性。

### `StaticRouteValue` {#type-staticroutevalue}

JSON 值递归联合：`null | boolean | number | string | StaticRouteValue[] | { [key: string]: StaticRouteValue }`。编译器拒绝非有限数值、空槽、函数、访问器、展开和动态引用。

<!--@include: ../../.partials/wevu-api/router-types/01-位置与参数类型.md-->

<!--@include: ../../.partials/wevu-api/router-types/02-守卫与失败类型.md-->

<!--@include: ../../.partials/wevu-api/router-types/03-路由记录类型.md-->

<!--@include: ../../.partials/wevu-api/router-types/04-小程序-router-类型.md-->
