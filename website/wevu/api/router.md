---
title: Wevu Router API
description: wevu/router 完整 API 参考，覆盖入口函数、Router 实例、导航守卫、动态路由和公开类型。
outline:
  level: [2, 3]
keywords:
  - wevu/router
  - createRouter
  - useRouter
  - Vue Router
  - 小程序路由
---

# Wevu Router API

本页对应 `wevu/router` 的公开导出，以及 `createRouter()` 返回实例的公共契约。Wevu Router 对齐 Vue Router 的主要使用心智，但最终导航仍受小程序页面栈、tabBar 和宿主 API 约束。

```ts
import { createRouter, useRoute, useRouter } from 'wevu/router'
```

## Router 入口

### `createRouter()` {#createrouter}

创建并注册默认 Router。选项支持路由记录、tabBar 路径、params 模式、重定向上限、query codec 和导航失败策略。

### `useRouter()` {#userouter}

读取当前已创建的 Router；调用前必须先执行 `createRouter()`。

### `useRoute()` {#useroute}

在 `setup()` 同步阶段读取只读的当前路由状态，并随页面生命周期和导航完成事件更新。

## 原生 Router

### `useNativeRouter()` {#usenativerouter}

获取当前组件路径语义的原生 Router，直接暴露小程序导航能力。

### `useNativePageRouter()` {#usenativepagerouter}

获取当前页面路径语义的原生 Router，适合页面级相对导航。

## 解析与导航失败

### `resolveRouteLocation()` {#resolveroutelocation}

将字符串或位置对象解析为标准路由位置，可传入当前路径处理相对地址。

### `parseQuery()` {#parsequery}

把 query 字符串解析为 `LocationQuery`。

### `stringifyQuery()` {#stringifyquery}

把 `LocationQueryRaw` 序列化为 query 字符串。

### `createNavigationFailure()` {#createnavigationfailure}

创建带失败类型、目标位置、来源位置和原始原因的导航失败对象。

### `isNavigationFailure()` {#isnavigationfailure}

判断异常或导航结果是否为 Wevu 导航失败，也可按失败类型过滤。

### `NavigationFailureType` {#navigationfailuretype}

运行时失败类型常量，包含 `unknown`、`aborted`、`cancelled` 和 `duplicated`。

## Router 实例

### `router.nativeRouter` {#router-nativerouter}

Router 内部使用的原生 `SetupContextRouter`。

### `router.options` {#router-options}

创建 Router 时使用的只读、规范化选项快照。

### `router.currentRoute` {#router-currentroute}

当前只读路由位置，包含 path、query、params、matched 和 redirectedFrom 等信息。

### `router.install()` {#router-install}

注册当前 Router，并在 App 支持 `globalProperties` 时写入 `$router`。

### `router.resolve()` {#router-resolve}

基于当前路由和 Router 配置解析目标位置，不执行实际跳转。

### `router.isReady()` {#router-isready}

返回 Router 就绪 Promise；当前小程序实现创建后即可就绪。

## 导航方法

### `router.push()` {#router-push}

执行前进导航，通常映射到 `navigateTo`，也会处理 tabBar、守卫、重定向和失败分类。

### `router.replace()` {#router-replace}

替换当前页面，通常映射到 `redirectTo`。

### `router.back()` {#router-back}

按指定层数返回；默认返回一层。

### `router.go()` {#router-go}

使用相对层数操作页面栈；小程序环境只支持可映射的返回语义。

### `router.forward()` {#router-forward}

保留 Vue Router 心智的前进入口；小程序没有浏览器 forward 栈，通常返回 `aborted` 失败。

## 动态路由

### `router.hasRoute()` {#router-hasroute}

按名称判断路由记录是否存在。

### `router.getRoutes()` {#router-getroutes}

返回当前规范化路由记录列表。

### `router.addRoute()` {#router-addroute}

新增顶层或子路由记录，返回移除该记录的函数。

### `router.removeRoute()` {#router-removeroute}

按名称移除路由记录。

### `router.clearRoutes()` {#router-clearroutes}

清空动态路由注册表。

## 导航守卫

### `router.beforeEach()` {#router-beforeeach}

注册全局前置守卫，返回取消注册函数。

### `router.beforeResolve()` {#router-beforeresolve}

注册导航确认前守卫，运行在 `beforeEach` 和路由记录 `beforeEnter` 之后。

### `router.afterEach()` {#router-aftereach}

注册导航完成回调，可读取失败对象和小程序导航上下文。

### `router.onError()` {#router-onerror}

注册异常型导航失败处理器，返回取消注册函数。

## 兼容边界

- `forward()`、hash-only 导航和页面栈行为受小程序宿主限制。
- `useRoute()` 必须在 `setup()` 同步阶段调用，不能放在 `await` 之后。
- `useNativeRouter()` / `useNativePageRouter()` 直接面向宿主能力；高阶导航优先使用 `createRouter()` / `useRouter()`。
- 所有公开类型见 [Wevu Router 类型参考](/wevu/api/router-types)。
- 详细示例和迁移建议见 [wevu/router 使用指南](/wevu/router)。
