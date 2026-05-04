---
title: Type Reference
description: 本页仅保留业务开发最常用的公开类型。内部运行时类型不会在文档中展开。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - reference
  - types
---

# Type Reference（类型总览）

本页提供最常用的公开类型速查，避免把内部实现类型暴露为常规 API。

## 组件与应用

### `CreateAppOptions` {#createappoptions}

`createApp()` 的参数类型。

### `DefineComponentOptions` {#definecomponentoptions}

`defineComponent()` 的参数类型。

### `ComponentDefinition` {#componentdefinition}

`defineComponent()` 返回定义结构类型。

### `SetupContext` {#setupcontext}

`setup(props, ctx)` 中 `ctx` 的类型。

### `RuntimeInstance` {#runtimeinstance}

页面/组件运行时实例类型。

### `MiniProgram*` / `HostMiniProgram*` {#miniprogram-types}

小程序宿主中立类型与底层宿主类型别名，例如 `MiniProgramRouter`、`MiniProgramSelectorQuery`、`MiniProgramIntersectionObserver`、`MiniProgramBoundingClientRectResult`、`HostMiniProgramPageScrollOption`。

推荐业务代码优先使用 `MiniProgram*` 命名；只有在明确需要表达底层宿主来源时再使用 `HostMiniProgram*`。

## 响应式与监听

### `Ref` {#ref-type}

基础响应式引用类型。

### `ShallowRef` {#shallowref-type}

浅层响应式引用类型。

### `WatchOptions` {#watchoptions}

`watch/watchEffect` 配置类型。

### `WatchStopHandle` {#watchstophandle}

watch 停止句柄类型。

### `MaybeRefOrGetter` {#maybereforgetter}

可接收值、Ref 或 getter 的联合类型。

## Store

### `StoreManager` {#storemanager}

store 根管理器类型。

### `DefineStoreOptions` {#definestoreoptions}

defineStore 选项类型。

### `StoreToRefsResult` {#storetorefsresult}

`storeToRefs()` 返回类型。

### `MutationType` {#mutationtype}

store mutation 类型。

## 运行时配置

### `WevuDefaults` {#wevudefaults}

`setWevuDefaults()` 配置类型。

### `ModelBinding` {#modelbinding}

`defineModel/useModel/useBindModel` 相关绑定类型。

### `ModelBindingOptions` / `ModelBindingPayload` {#modelbindingpayload}

`useBindModel()`、`useChangeModel()` 生成 value + handler payload 时使用的参数与返回类型。

### `TriggerEventOptions` {#triggereventoptions}

事件触发选项类型。

### `UseElementIntersectionObserverOptions` {#useelementintersectionobserveroptions}

`useElementIntersectionObserver()` 的参数类型。

### `UseBoundingClientRectOptions` / `UseSelectorFieldsOptions` / `UseScrollOffsetOptions` {#selector-query-options}

节点查询相关组合式 API 的参数类型。

### `PageStackSnapshot` / `UsePageStackOptions` {#pagestack-types}

页面栈快照和 `usePageStack()` 配置类型。

### `NavigationBarMetrics` / `UseNavigationBarMetricsOptions` {#navigationbar-types}

自定义导航栏尺寸快照和 `useNavigationBarMetrics()` 配置类型。

### `UseAsyncPullDownRefreshOptions` {#async-pulldown-types}

`useAsyncPullDownRefresh()` 的错误处理和停止刷新函数配置类型。

## 说明

更多底层与内部类型仍可在类型声明文件中找到，但不属于推荐直接依赖的公共 API 文档范围。
