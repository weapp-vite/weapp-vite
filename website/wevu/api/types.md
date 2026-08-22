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

### `RuntimeApp` {#runtimeapp}

`createApp()` 的返回类型，公开 `mount/use/provide/onUnmount/unmount/config/version`。它不是 Vue DOM App 的完整类型，不包含 `component/directive/mixin/runWithContext`。

### `AppConfig` {#appconfig}

Wevu 应用配置类型，当前只公开 `globalProperties: Record<string, any>`。它不包含 Vue DOM App 的 error/warn handler、option merge strategies、compiler options 等配置面。

### `WevuPlugin` {#wevuplugin}

插件可以是 `(app, ...options) => any` 函数，也可以是带 `install(app, ...options)` 的对象。

### `CreateAppOptions` {#createappoptions}

`createApp()` 的参数类型。

### `DefineComponentOptions` {#definecomponentoptions}

`defineComponent()` 的参数类型。

### `ComponentDefinition` {#componentdefinition}

`defineComponent()` 返回定义结构类型。

### `SetupContext` {#setupcontext}

`setup(props, ctx)` 中 `ctx` 的类型。除 `attrs`、`slots`、`emit`、`expose` 外还包含小程序 `instance`、router、selector query 和 Wevu runtime 桥接；`emit` 使用单个 `detail` 载荷，不是 Vue 的可变参数事件。

### `ComponentPublicInstance` {#componentpublicinstance}

Wevu state、computed、methods、props 与 `$nextTick/$watch/$emit` 的代理交集。它不是 Vue DOM 组件代理，不承诺 `$el`、DOM vnode 树或 renderer internals。

### `RuntimeInstance` {#runtimeinstance}

页面/组件运行时实例类型。

### `MiniProgram*` / `HostMiniProgram*` {#miniprogram-types}

小程序宿主中立类型与底层宿主类型别名，例如 `MiniProgramRouter`、`MiniProgramSelectorQuery`、`MiniProgramIntersectionObserver`、`MiniProgramBoundingClientRectResult`、`HostMiniProgramPageScrollOption`。

推荐业务代码优先使用 `MiniProgram*` 命名；只有在明确需要表达底层宿主来源时再使用 `HostMiniProgram*`。

## 响应式与监听

### `PropType<T>` {#proptype}

用于给小程序 `properties` 构造器附加 TypeScript 值类型。它接受 Wevu 的 `PropConstructor` 或构造器数组，但运行时仍要归一化为宿主支持的 property type，不能视为 Vue runtime props validator 的完整替代。

### `VNode` / `VNodeProps` {#vnode}

公开名称用于兼容 Vue 类型导入；Wevu 实际渲染由静态 WXML 或 JSX island 承载，不提供 Vue DOM renderer 的 vnode patch 契约。

### `ObjectDirective` {#objectdirective}

类型形状复用 Vue 指令定义，只有编译器可识别或 Wevu 能桥接的指令语义可用；声明同名类型不代表任意 DOM directive hook 可在小程序执行。

### `MaybeRef<T>` {#mayberef}

表示普通值、`Ref`、`ShallowRef` 或可写计算值，适合声明可接受响应式输入的组合式函数。

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

### `ExtractPropTypes<T>` {#extractproptypes}

从 Wevu `ComponentPropsOptions` 推导组件内部可见的 props 类型，required/default 判定按小程序 properties 归一化规则处理。

### `ExtractPublicPropTypes<T>` {#extractpublicproptypes}

从 Wevu props 配置推导父组件可传入的公开 props 类型。当前与 `InferProps` 使用同一推导边界，不复刻 Vue 内部/公开 props 的全部差异。

> 同名不等于同契约。公开 compatibility catalog 会通过 TypeScript AST 审计 `wevu` 与 `vue` 的重名类型；每个重名项必须被标为兼容或给出差异摘要，新增类型不能静默进入文档。

### `ComponentCustomProps` {#componentcustomprops}

沿用 Vue 的组件自定义 props 扩展类型，可通过模块增强补充跨组件属性。

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
