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

## 1. 高频类型速查

| 类型                     | 链接                                                                                                   | 说明                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `SetupContext`           | [/wevu/api/index/interfaces/SetupContext](/wevu/api/index/interfaces/SetupContext)                     | `setup(props, ctx)` 的上下文类型。                   |
| `RuntimeInstance`        | [/wevu/api/index/interfaces/RuntimeInstance](/wevu/api/index/interfaces/RuntimeInstance)               | 运行时实例，含 snapshot/watch/bindModel 等能力。     |
| `ComponentDefinition`    | [/wevu/api/index/interfaces/ComponentDefinition](/wevu/api/index/interfaces/ComponentDefinition)       | 小程序组件定义结构。                                 |
| `DefineComponentOptions` | [/wevu/api/index/interfaces/DefineComponentOptions](/wevu/api/index/interfaces/DefineComponentOptions) | `defineComponent` 参数类型。                         |
| `CreateAppOptions`       | [/wevu/api/index/interfaces/CreateAppOptions](/wevu/api/index/interfaces/CreateAppOptions)             | `createApp` 参数类型。                               |
| `DefineStoreOptions`     | [/wevu/api/index/interfaces/DefineStoreOptions](/wevu/api/index/interfaces/DefineStoreOptions)         | `defineStore` 参数类型。                             |
| `WatchOptions`           | [/wevu/api/index/interfaces/WatchOptions](/wevu/api/index/interfaces/WatchOptions)                     | `watch/watchEffect` 配置。                           |
| `ModelBinding`           | [/wevu/api/index/interfaces/ModelBinding](/wevu/api/index/interfaces/ModelBinding)                     | `bindModel/useModel` 绑定结果。                      |
| `NativeComponent`        | [/wevu/api/index/type-aliases/NativeComponent](/wevu/api/index/type-aliases/NativeComponent)           | 原生组件导入时的轻量类型包装。                       |
| `InferNativeProps`       | [/wevu/api/index/type-aliases/InferNativeProps](/wevu/api/index/type-aliases/InferNativeProps)         | 从原生 `properties` 自动推导 props。                 |
| `NativePropType`         | [/wevu/api/index/type-aliases/NativePropType](/wevu/api/index/type-aliases/NativePropType)             | 原生 `properties.type` 的泛型提示（类 `PropType`）。 |
| `TriggerEventOptions`    | [/wevu/api/index/type-aliases/TriggerEventOptions](/wevu/api/index/type-aliases/TriggerEventOptions)   | `emit/triggerEvent` 选项类型。                       |
| `WevuDefaults`           | [/wevu/api/index/interfaces/WevuDefaults](/wevu/api/index/interfaces/WevuDefaults)                     | `setWevuDefaults` 配置结构。                         |
| `MiniProgramInstance`    | [/wevu/api/index/type-aliases/MiniProgramInstance](/wevu/api/index/type-aliases/MiniProgramInstance)   | setup 中原生实例类型。                               |
| `WevuPlugin`             | [/wevu/api/index/type-aliases/WevuPlugin](/wevu/api/index/type-aliases/WevuPlugin)                     | 插件函数类型。                                       |

## 2. 接口（Interfaces）全量索引

| 接口                                                                                    | 领域                 |
| --------------------------------------------------------------------------------------- | -------------------- |
| [`ActionSubscriber`](/wevu/api/index/interfaces/ActionSubscriber)                       | Store/action 订阅    |
| [`AppConfig`](/wevu/api/index/interfaces/AppConfig)                                     | App 配置             |
| [`ComponentDefinition`](/wevu/api/index/interfaces/ComponentDefinition)                 | 组件定义             |
| [`ComputedRef`](/wevu/api/index/interfaces/ComputedRef)                                 | 只读 computed        |
| [`CreateAppOptions`](/wevu/api/index/interfaces/CreateAppOptions)                       | createApp 参数       |
| [`DefineAppOptions`](/wevu/api/index/interfaces/DefineAppOptions)                       | App 定义参数         |
| [`DefineComponentOptions`](/wevu/api/index/interfaces/DefineComponentOptions)           | defineComponent 参数 |
| [`DefineStoreOptions`](/wevu/api/index/interfaces/DefineStoreOptions)                   | defineStore 参数     |
| [`EffectScope`](/wevu/api/index/interfaces/EffectScope)                                 | effect 作用域        |
| [`GlobalComponents`](/wevu/api/index/interfaces/GlobalComponents)                       | 全局组件扩展         |
| [`GlobalDirectives`](/wevu/api/index/interfaces/GlobalDirectives)                       | 全局指令扩展         |
| [`InternalRuntimeStateFields`](/wevu/api/index/interfaces/InternalRuntimeStateFields)   | 运行时内部状态       |
| [`MiniProgramAdapter`](/wevu/api/index/interfaces/MiniProgramAdapter)                   | 平台适配器           |
| [`MiniProgramComponentOptions`](/wevu/api/index/interfaces/MiniProgramComponentOptions) | 小程序组件配置       |
| [`ModelBinding`](/wevu/api/index/interfaces/ModelBinding)                               | 双向绑定结果         |
| [`ModelBindingOptions`](/wevu/api/index/interfaces/ModelBindingOptions)                 | 双向绑定选项         |
| [`MutationRecord`](/wevu/api/index/interfaces/MutationRecord)                           | mutation 记录        |
| [`PageFeatures`](/wevu/api/index/interfaces/PageFeatures)                               | 页面 feature 开关    |
| [`PrelinkReactiveTreeOptions`](/wevu/api/index/interfaces/PrelinkReactiveTreeOptions)   | reactive 预链接选项  |
| [`PropOptions`](/wevu/api/index/interfaces/PropOptions)                                 | prop 选项            |
| [`RuntimeApp`](/wevu/api/index/interfaces/RuntimeApp)                                   | App 运行时实例       |
| [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance)                         | 页面/组件运行时实例  |
| [`SetDataDebugInfo`](/wevu/api/index/interfaces/SetDataDebugInfo)                       | setData 调试信息     |
| [`SetDataSnapshotOptions`](/wevu/api/index/interfaces/SetDataSnapshotOptions)           | setData 快照选项     |
| [`SetupContext`](/wevu/api/index/interfaces/SetupContext)                               | setup 上下文         |
| [`StoreManager`](/wevu/api/index/interfaces/StoreManager)                               | store 管理器         |
| [`SubscriptionCallback`](/wevu/api/index/interfaces/SubscriptionCallback)               | 订阅回调             |
| [`TemplateRefs`](/wevu/api/index/interfaces/TemplateRefs)                               | 模板 ref 集合        |
| [`TemplateRefValue`](/wevu/api/index/interfaces/TemplateRefValue)                       | 模板 ref 值类型      |
| [`WatchOptions`](/wevu/api/index/interfaces/WatchOptions)                               | watch 配置           |
| [`WevuDefaults`](/wevu/api/index/interfaces/WevuDefaults)                               | 全局默认值配置       |
| [`WevuGlobalComponents`](/wevu/api/index/interfaces/WevuGlobalComponents)               | wevu 全局组件        |
| [`WevuGlobalDirectives`](/wevu/api/index/interfaces/WevuGlobalDirectives)               | wevu 全局指令        |
| [`WritableComputedOptions`](/wevu/api/index/interfaces/WritableComputedOptions)         | 可写 computed 配置   |
| [`WritableComputedRef`](/wevu/api/index/interfaces/WritableComputedRef)                 | 可写 computed 引用   |

## 3. 类型别名（Type Aliases）全量索引

### 3.1 组件、Props、宏相关

| 类型别名                                                                          | 说明                       |
| --------------------------------------------------------------------------------- | -------------------------- |
| [`AllowedComponentProps`](/wevu/api/index/type-aliases/AllowedComponentProps)     | 允许透传的组件属性         |
| [`ComponentCustomProps`](/wevu/api/index/type-aliases/ComponentCustomProps)       | 自定义组件属性扩展         |
| [`ComponentOptionsMixin`](/wevu/api/index/type-aliases/ComponentOptionsMixin)     | 组件选项 mixin             |
| [`ComponentPropsOptions`](/wevu/api/index/type-aliases/ComponentPropsOptions)     | props 选项定义             |
| [`ComponentPublicInstance`](/wevu/api/index/type-aliases/ComponentPublicInstance) | 公共实例类型               |
| [`DefineComponent`](/wevu/api/index/type-aliases/DefineComponent)                 | defineComponent 类型签名   |
| [`EmitsOptions`](/wevu/api/index/type-aliases/EmitsOptions)                       | emits 配置类型             |
| [`ExtractDefaultPropTypes`](/wevu/api/index/type-aliases/ExtractDefaultPropTypes) | 默认值推断                 |
| [`ExtractPropTypes`](/wevu/api/index/type-aliases/ExtractPropTypes)               | props 推断结果             |
| [`ExtractPublicPropTypes`](/wevu/api/index/type-aliases/ExtractPublicPropTypes)   | 对外 props 推断            |
| [`InferPropType`](/wevu/api/index/type-aliases/InferPropType)                     | 单个 prop 类型推断         |
| [`InferProps`](/wevu/api/index/type-aliases/InferProps)                           | props 对象推断             |
| [`InferNativePropType`](/wevu/api/index/type-aliases/InferNativePropType)         | 原生 property 单项推断     |
| [`InferNativeProps`](/wevu/api/index/type-aliases/InferNativeProps)               | 原生 properties 对象推断   |
| [`NativeComponent`](/wevu/api/index/type-aliases/NativeComponent)                 | 原生组件类型包装           |
| [`NativePropType`](/wevu/api/index/type-aliases/NativePropType)                   | 原生 property type 泛型    |
| [`NativeTypedProperty`](/wevu/api/index/type-aliases/NativeTypedProperty)         | 原生 property 进阶兜底提示 |
| [`PropConstructor`](/wevu/api/index/type-aliases/PropConstructor)                 | prop 构造器类型            |
| [`PropType`](/wevu/api/index/type-aliases/PropType)                               | prop 类型声明              |
| [`PublicProps`](/wevu/api/index/type-aliases/PublicProps)                         | 公共 props 合集            |
| [`SetupFunction`](/wevu/api/index/type-aliases/SetupFunction)                     | setup 函数签名             |
| [`TriggerEventOptions`](/wevu/api/index/type-aliases/TriggerEventOptions)         | triggerEvent 选项          |
| [`VNode`](/wevu/api/index/type-aliases/VNode)                                     | VNode 兼容类型             |
| [`VNodeProps`](/wevu/api/index/type-aliases/VNodeProps)                           | VNode props 兼容类型       |

### 3.2 响应式与工具类型

| 类型别名                                                                  | 说明                 |
| ------------------------------------------------------------------------- | -------------------- |
| [`ComputedDefinitions`](/wevu/api/index/type-aliases/ComputedDefinitions) | computed 定义集合    |
| [`ComputedGetter`](/wevu/api/index/type-aliases/ComputedGetter)           | computed getter      |
| [`ComputedSetter`](/wevu/api/index/type-aliases/ComputedSetter)           | computed setter      |
| [`ExtractComputed`](/wevu/api/index/type-aliases/ExtractComputed)         | 提取 computed 返回值 |
| [`ExtractMethods`](/wevu/api/index/type-aliases/ExtractMethods)           | 提取 methods 返回值  |
| [`MaybeRef`](/wevu/api/index/type-aliases/MaybeRef)                       | 值或 Ref             |
| [`MaybeRefOrGetter`](/wevu/api/index/type-aliases/MaybeRefOrGetter)       | 值或 Ref 或 getter   |
| [`MethodDefinitions`](/wevu/api/index/type-aliases/MethodDefinitions)     | methods 定义集合     |
| [`Ref`](/wevu/api/index/type-aliases/Ref)                                 | Ref 类型             |
| [`ShallowRef`](/wevu/api/index/type-aliases/ShallowRef)                   | ShallowRef 类型      |
| [`ShallowUnwrapRef`](/wevu/api/index/type-aliases/ShallowUnwrapRef)       | shallow 解包类型     |
| [`ToRefs`](/wevu/api/index/type-aliases/ToRefs)                           | toRefs 返回类型      |
| [`WatchStopHandle`](/wevu/api/index/type-aliases/WatchStopHandle)         | watch 停止句柄       |

### 3.3 小程序桥接与运行时内部

| 类型别名                                                                                                  | 说明               |
| --------------------------------------------------------------------------------------------------------- | ------------------ |
| [`InternalRuntimeState`](/wevu/api/index/type-aliases/InternalRuntimeState)                               | 运行时内部状态     |
| [`MiniProgramAppOptions`](/wevu/api/index/type-aliases/MiniProgramAppOptions)                             | App 原生配置       |
| [`MiniProgramBehaviorIdentifier`](/wevu/api/index/type-aliases/MiniProgramBehaviorIdentifier)             | Behavior 标识符    |
| [`MiniProgramComponentBehaviorOptions`](/wevu/api/index/type-aliases/MiniProgramComponentBehaviorOptions) | 组件 behavior 配置 |
| [`MiniProgramComponentRawOptions`](/wevu/api/index/type-aliases/MiniProgramComponentRawOptions)           | 组件原始配置       |
| [`MiniProgramInstance`](/wevu/api/index/type-aliases/MiniProgramInstance)                                 | 原生组件/页面实例  |
| [`MiniProgramPageLifetimes`](/wevu/api/index/type-aliases/MiniProgramPageLifetimes)                       | 页面生命周期类型   |
| [`ObjectDirective`](/wevu/api/index/type-aliases/ObjectDirective)                                         | 指令对象类型       |
| [`TemplateRef`](/wevu/api/index/type-aliases/TemplateRef)                                                 | 模板 ref 类型      |

### 3.4 store / model / mutation

| 类型别名                                                                  | 说明               |
| ------------------------------------------------------------------------- | ------------------ |
| [`ModelBindingPayload`](/wevu/api/index/type-aliases/ModelBindingPayload) | model 绑定 payload |
| [`MutationKind`](/wevu/api/index/type-aliases/MutationKind)               | mutation 种类      |
| [`MutationOp`](/wevu/api/index/type-aliases/MutationOp)                   | mutation 操作      |
| [`MutationType`](/wevu/api/index/type-aliases/MutationType)               | mutation 类型      |
| [`WevuPlugin`](/wevu/api/index/type-aliases/WevuPlugin)                   | 插件类型           |

## 4. 编译侧类型（`wevu/compiler`）

| 类型别名              | 链接                                                                                                       | 说明                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `WevuRuntimeApiName`  | [/wevu/api/compiler/type-aliases/WevuRuntimeApiName](/wevu/api/compiler/type-aliases/WevuRuntimeApiName)   | 编译器识别的运行时 API 名字联合。 |
| `WevuPageHookName`    | [/wevu/api/compiler/type-aliases/WevuPageHookName](/wevu/api/compiler/type-aliases/WevuPageHookName)       | 页面 hook 名字联合。              |
| `WevuPageFeatureFlag` | [/wevu/api/compiler/type-aliases/WevuPageFeatureFlag](/wevu/api/compiler/type-aliases/WevuPageFeatureFlag) | 页面 feature 开关联合。           |

## 5. 相关页

- Core API：[/wevu/api-reference/core](/wevu/api-reference/core)
- Reactivity API：[/wevu/api-reference/reactivity](/wevu/api-reference/reactivity)
- Runtime Bridge API：[/wevu/api-reference/runtime-bridge](/wevu/api-reference/runtime-bridge)
