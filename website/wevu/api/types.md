---
title: Type Reference
description: 本页先给出“高频类型速查”，然后提供 wevu 当前导出的接口/类型别名全量索引。
keywords:
  - wevu
  - 微信小程序
  - 运行时
  - 编译
  - api
  - reference
  - types
  - type
---

# Type Reference（类型总览）

本页先给出“高频类型速查”，然后提供 `wevu` 当前导出的接口/类型别名全量索引。

## 1. 高频类型速查 {#quick-reference}

| 类型                     | 链接                     | 说明                                                 |
| ------------------------ | ------------------------ | ---------------------------------------------------- |
| `SetupContext`           | `SetupContext`           | `setup(props, ctx)` 的上下文类型。                   |
| `RuntimeInstance`        | `RuntimeInstance`        | 运行时实例，含 snapshot/watch/bindModel 等能力。     |
| `ComponentDefinition`    | `ComponentDefinition`    | 小程序组件定义结构。                                 |
| `DefineComponentOptions` | `DefineComponentOptions` | `defineComponent` 参数类型。                         |
| `CreateAppOptions`       | `CreateAppOptions`       | `createApp` 参数类型。                               |
| `DefineStoreOptions`     | `DefineStoreOptions`     | `defineStore` 参数类型。                             |
| `WatchOptions`           | `WatchOptions`           | `watch/watchEffect` 配置。                           |
| `ModelBinding`           | `ModelBinding`           | `bindModel/useModel` 绑定结果。                      |
| `NativeComponent`        | `NativeComponent`        | 原生组件导入时的轻量类型包装。                       |
| `InferNativeProps`       | `InferNativeProps`       | 从原生 `properties` 自动推导 props。                 |
| `NativePropType`         | `NativePropType`         | 原生 `properties.type` 的泛型提示（类 `PropType`）。 |
| `TriggerEventOptions`    | `TriggerEventOptions`    | `emit/triggerEvent` 选项类型。                       |
| `WevuDefaults`           | `WevuDefaults`           | `setWevuDefaults` 配置结构。                         |
| `MiniProgramInstance`    | `MiniProgramInstance`    | setup 中原生实例类型。                               |
| `WevuPlugin`             | `WevuPlugin`             | 插件函数类型。                                       |

## 2. 接口（Interfaces）全量索引 {#interfaces-index}

| 接口                          | 领域                 |
| ----------------------------- | -------------------- |
| `ActionSubscriber`            | Store/action 订阅    |
| `AppConfig`                   | App 配置             |
| `ComponentDefinition`         | 组件定义             |
| `ComputedRef`                 | 只读 computed        |
| `CreateAppOptions`            | createApp 参数       |
| `DefineAppOptions`            | App 定义参数         |
| `DefineComponentOptions`      | defineComponent 参数 |
| `DefineStoreOptions`          | defineStore 参数     |
| `EffectScope`                 | effect 作用域        |
| `GlobalComponents`            | 全局组件扩展         |
| `GlobalDirectives`            | 全局指令扩展         |
| `InternalRuntimeStateFields`  | 运行时内部状态       |
| `MiniProgramAdapter`          | 平台适配器           |
| `MiniProgramComponentOptions` | 小程序组件配置       |
| `ModelBinding`                | 双向绑定结果         |
| `ModelBindingOptions`         | 双向绑定选项         |
| `MutationRecord`              | mutation 记录        |
| `PageFeatures`                | 页面 feature 开关    |
| `PrelinkReactiveTreeOptions`  | reactive 预链接选项  |
| `PropOptions`                 | prop 选项            |
| `RuntimeApp`                  | App 运行时实例       |
| `RuntimeInstance`             | 页面/组件运行时实例  |
| `SetDataDebugInfo`            | setData 调试信息     |
| `SetDataSnapshotOptions`      | setData 快照选项     |
| `SetupContext`                | setup 上下文         |
| `StoreManager`                | store 管理器         |
| `SubscriptionCallback`        | 订阅回调             |
| `TemplateRefs`                | 模板 ref 集合        |
| `TemplateRefValue`            | 模板 ref 值类型      |
| `WatchOptions`                | watch 配置           |
| `WevuDefaults`                | 全局默认值配置       |
| `WevuGlobalComponents`        | wevu 全局组件        |
| `WevuGlobalDirectives`        | wevu 全局指令        |
| `WritableComputedOptions`     | 可写 computed 配置   |
| `WritableComputedRef`         | 可写 computed 引用   |

## 3. 类型别名（Type Aliases）全量索引 {#aliases-index}

### 3.1 组件、Props、宏相关

| 类型别名                  | 说明                       |
| ------------------------- | -------------------------- |
| `AllowedComponentProps`   | 允许透传的组件属性         |
| `ComponentCustomProps`    | 自定义组件属性扩展         |
| `ComponentOptionsMixin`   | 组件选项 mixin             |
| `ComponentPropsOptions`   | props 选项定义             |
| `ComponentPublicInstance` | 公共实例类型               |
| `DefineComponent`         | defineComponent 类型签名   |
| `EmitsOptions`            | emits 配置类型             |
| `ExtractDefaultPropTypes` | 默认值推断                 |
| `ExtractPropTypes`        | props 推断结果             |
| `ExtractPublicPropTypes`  | 对外 props 推断            |
| `InferPropType`           | 单个 prop 类型推断         |
| `InferProps`              | props 对象推断             |
| `InferNativePropType`     | 原生 property 单项推断     |
| `InferNativeProps`        | 原生 properties 对象推断   |
| `NativeComponent`         | 原生组件类型包装           |
| `NativePropType`          | 原生 property type 泛型    |
| `NativeTypedProperty`     | 原生 property 进阶兜底提示 |
| `PropConstructor`         | prop 构造器类型            |
| `PropType`                | prop 类型声明              |
| `PublicProps`             | 公共 props 合集            |
| `SetupFunction`           | setup 函数签名             |
| `TriggerEventOptions`     | triggerEvent 选项          |
| `VNode`                   | VNode 兼容类型             |
| `VNodeProps`              | VNode props 兼容类型       |

### 3.2 响应式与工具类型

| 类型别名              | 说明                 |
| --------------------- | -------------------- |
| `ComputedDefinitions` | computed 定义集合    |
| `ComputedGetter`      | computed getter      |
| `ComputedSetter`      | computed setter      |
| `ExtractComputed`     | 提取 computed 返回值 |
| `ExtractMethods`      | 提取 methods 返回值  |
| `MaybeRef`            | 值或 Ref             |
| `MaybeRefOrGetter`    | 值或 Ref 或 getter   |
| `MethodDefinitions`   | methods 定义集合     |
| `Ref`                 | Ref 类型             |
| `ShallowRef`          | ShallowRef 类型      |
| `ShallowUnwrapRef`    | shallow 解包类型     |
| `ToRefs`              | toRefs 返回类型      |
| `WatchStopHandle`     | watch 停止句柄       |

### 3.3 小程序桥接与运行时内部

| 类型别名                              | 说明               |
| ------------------------------------- | ------------------ |
| `InternalRuntimeState`                | 运行时内部状态     |
| `MiniProgramAppOptions`               | App 原生配置       |
| `MiniProgramBehaviorIdentifier`       | Behavior 标识符    |
| `MiniProgramComponentBehaviorOptions` | 组件 behavior 配置 |
| `MiniProgramComponentRawOptions`      | 组件原始配置       |
| `MiniProgramInstance`                 | 原生组件/页面实例  |
| `MiniProgramPageLifetimes`            | 页面生命周期类型   |
| `ObjectDirective`                     | 指令对象类型       |
| `TemplateRef`                         | 模板 ref 类型      |

### 3.4 store / model / mutation

| 类型别名              | 说明               |
| --------------------- | ------------------ |
| `ModelBindingPayload` | model 绑定 payload |
| `MutationKind`        | mutation 种类      |
| `MutationOp`          | mutation 操作      |
| `MutationType`        | mutation 类型      |
| `WevuPlugin`          | 插件类型           |

## 4. 编译侧类型（`wevu/compiler`）

| 类型别名              | 链接                  | 说明                              |
| --------------------- | --------------------- | --------------------------------- |
| `WevuRuntimeApiName`  | `WevuRuntimeApiName`  | 编译器识别的运行时 API 名字联合。 |
| `WevuPageHookName`    | `WevuPageHookName`    | 页面 hook 名字联合。              |
| `WevuPageFeatureFlag` | `WevuPageFeatureFlag` | 页面 feature 开关联合。           |

## 5. 相关页

- Core API：[/wevu/api/core](/wevu/api/core)
- Reactivity API：[/wevu/api/reactivity](/wevu/api/reactivity)
- Runtime Bridge API：[/wevu/api/runtime-bridge](/wevu/api/runtime-bridge)
