---
title: Wevu Router 类型
description: wevu/router 的公开 TypeScript 类型，覆盖位置、参数、守卫、失败、路由记录和小程序宿主 Router。
outline:
  level: [2, 3]
keywords:
  - wevu/router
  - TypeScript
  - RouteLocation
  - NavigationGuard
  - RouterNavigation
---

# Wevu Router 类型

以下类型均从 `wevu/router` 导出。运行时函数和 Router 实例方法见 [Wevu Router API](/wevu/api/router)。

## 位置与参数类型

### `RouterNavigation` {#type-routernavigation}

`createRouter()` 返回的完整 Router 实例类型。

### `UseRouterOptions` {#type-userouteroptions}

Router 创建选项，包含 routes、tabBar、params、query codec 和失败策略。

### `AddRoute` {#type-addroute}

`router.addRoute()` 的重载函数类型。

### `RouteLocationRaw` {#type-routelocationraw}

导航方法接受的字符串或未规范化位置对象。

### `RouteLocationNormalizedLoaded` {#type-routelocationnormalizedloaded}

已解析并加载的当前路由位置。

### `RouteLocationRedirectedFrom` {#type-routelocationredirectedfrom}

重定向前原始位置的只读快照结构。

### `LocationQuery` {#type-locationquery}

规范化后的 query 对象。

### `LocationQueryRaw` {#type-locationqueryraw}

导航输入可接受的原始 query 对象。

### `LocationQueryValue` {#type-locationqueryvalue}

规范化 query 的单值类型。

### `LocationQueryValueRaw` {#type-locationqueryvalueraw}

原始 query 可接受的单值类型。

### `RouteParams` {#type-routeparams}

规范化后的命名路由 params 对象。

### `RouteParamsRaw` {#type-routeparamsraw}

命名路由输入可接受的原始 params 对象。

### `RouteParamValue` {#type-routeparamvalue}

规范化 params 的字符串值类型。

### `RouteParamValueRaw` {#type-routeparamvalueraw}

原始 params 可接受的单值类型。

### `RouteParamsMode` {#type-routeparamsmode}

params 缺失或多余时采用的 `loose` 或 `strict` 策略。

### `RouteQueryParser` {#type-routequeryparser}

自定义 query 解析函数签名。

### `RouteQueryStringifier` {#type-routequerystringifier}

自定义 query 序列化函数签名。

## 守卫与失败类型

### `NavigationFailure` {#type-navigationfailure}

带类型、目标、来源和 cause 的导航失败对象。

### `NavigationFailureTypeValue` {#type-navigationfailuretypevalue}

`NavigationFailureType` 所有运行时值的联合类型。

### `NavigationMode` {#type-navigationmode}

导航执行模式：`push`、`replace` 或 `back`。

### `NavigationRedirect` {#type-navigationredirect}

守卫或路由记录返回的重定向描述。

### `NavigationGuard` {#type-navigationguard}

前置守卫函数签名。

### `NavigationGuardResult` {#type-navigationguardresult}

守卫可返回的继续、取消、失败位置或重定向结果。

### `NavigationGuardContext` {#type-navigationguardcontext}

前置守卫获得的小程序导航上下文。

### `NavigationAfterEach` {#type-navigationaftereach}

导航完成回调签名。

### `NavigationAfterEachContext` {#type-navigationaftereachcontext}

导航完成时的模式、位置、原生 Router 和失败信息。

### `NavigationErrorHandler` {#type-navigationerrorhandler}

异常型导航失败处理函数签名。

### `NavigationErrorContext` {#type-navigationerrorcontext}

错误处理器获得的导航上下文。

## 路由记录类型

### `NamedRouteRecord` {#type-namedrouterecord}

最小命名路由记录，包含 name 和 path。

### `NamedRoutes` {#type-namedroutes}

命名路由对象 map 或路由记录数组。

### `RouteMeta` {#type-routemeta}

路由记录自定义元信息。

### `RouteRecordInput` {#type-routerecordinput}

创建 Router 或添加动态路由时接受的记录结构。

### `RouteRecordRaw` {#type-routerecordraw}

具有必填 name 的规范化公开路由记录。

### `RouteRecordMatched` {#type-routerecordmatched}

当前路由 `matched` 中的匹配记录快照。

### `RouteRecordRedirect` {#type-routerecordredirect}

路由记录的静态或函数式重定向类型。

## 小程序 Router 类型

### `SetupContextRouter` {#type-setupcontextrouter}

Wevu `setup()` 上下文提供的原生小程序 Router。

### `RouterNavigateToOption` {#type-routernavigatetooption}

类型安全的 `navigateTo` 选项。

### `RouterRedirectToOption` {#type-routerredirecttooption}

类型安全的 `redirectTo` 选项。

### `RouterReLaunchOption` {#type-routerrelaunchoption}

类型安全的 `reLaunch` 选项。

### `RouterSwitchTabOption` {#type-routerswitchtaboption}

类型安全的 `switchTab` 选项。

### `TypedRouterUrl` {#type-typedrouterurl}

由项目路由类型映射推导出的页面 URL。

### `TypedRouterTabBarUrl` {#type-typedroutertabbarurl}

由项目路由类型映射推导出的 tabBar URL。

### `WevuTypedRouterRouteMap` {#type-wevutypedrouterroutemap}

供项目声明合并扩展的类型路由映射。
