---
title: Options API
description: Wevu 支持的 Vue 风格与小程序原生 Options API 清单，以及迁移时需要注意的语义差异。
keywords:
  - wevu
  - options api
  - vue migration
  - miniprogram
---

# Options API

Wevu 接受 Vue 风格选项，同时保留小程序 `Component` 的宿主选项。名称相同不代表运行时语义完全相同：组件注册、生命周期时机、props 规范化和更新最终都受小程序宿主约束。

## Vue 风格选项

### `props` {#props}

支持数组、对象和类型声明，并在注册阶段转换为小程序 `properties`。

### `emits` {#emits}

用于声明组件事件；实际派发通过小程序组件事件系统完成。

### `data` {#data}

支持对象或返回初始状态的函数，推荐使用函数形式。

### `setup` {#setup}

在 Wevu setup 上下文中执行。默认在组件 `attached` 阶段运行，与 Vue 组件创建时机存在差异。

### `computed` {#computed}

参与 Wevu 响应式快照和 `setData` 差量更新，不是 Vue DOM 渲染器的 computed 调度链路。

### `methods` {#methods}

方法会绑定到小程序公开实例，并可供模板事件处理器调用。

### `watch` {#watch}

监听 data、props 或 computed 路径；调度和深度监听能力以 [Reactivity API](/wevu/api/reactivity#watch) 为准。

## 小程序宿主选项

### `properties` {#properties}

原生小程序属性声明。新代码优先使用 `props`，需要宿主级 observer 或原生类型行为时使用本选项。

### `behaviors` {#behaviors}

透传小程序 behaviors 配置。

### `lifetimes` {#lifetimes}

透传组件生命周期；对应 Hook 映射见 [Lifecycle API](/wevu/api/lifecycle#小程序原生生命周期映射说明)。

### `pageLifetimes` {#pagelifetimes}

透传组件所在页面的生命周期。

### `externalClasses` {#externalclasses}

声明组件可接收的外部样式类。

### `options` {#options}

透传小程序组件选项，例如 `virtualHost`。

### `observers` {#observers}

透传小程序数据字段监听器。

### `relations` {#relations}

透传小程序组件关系定义。

### `features` {#features}

按需开启页面事件桥接，避免为未使用的页面事件生成处理函数。

### `setData` {#setdata}

配置快照、diff 和 `setData` payload 策略。

### `setupLifecycle` {#setuplifecycle}

选择 `setup` 在 `created` 或 `attached` 阶段执行，默认值为 `attached`。
