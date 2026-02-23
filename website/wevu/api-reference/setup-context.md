---
title: Setup Context API
---

# Setup Context API（setup 上下文）

`wevu` 的 `setup(props, ctx)` 除了 Vue 语义，还补齐了小程序运行时场景，特别是 `ctx.instance`（原生实例）和 `ctx.emit`（事件派发）。

## 1. `setup` 签名与核心类型

| 类型/接口           | 链接                                                                      | 说明                                         |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `setup(props, ctx)` | [`SetupFunction`](/wevu/api/index/type-aliases/SetupFunction)             | 组件/页面 setup 函数签名。                   |
| `ctx`               | [`SetupContext`](/wevu/api/index/interfaces/SetupContext)                 | setup 上下文总入口。                         |
| `ctx.runtime`       | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance)           | 运行时实例（watch、snapshot、teardown 等）。 |
| `ctx.instance`      | [`MiniProgramInstance`](/wevu/api/index/type-aliases/MiniProgramInstance) | 小程序原生实例。                             |
| `ctx.emit`          | [`TriggerEventOptions`](/wevu/api/index/type-aliases/TriggerEventOptions) | 自定义事件派发入口。                         |

## 2. setup 上下文相关 API

| API                                                                          | 类型入口                                                        | 说明                                       |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| [`getCurrentInstance`](/wevu/api/index/functions/getCurrentInstance)         | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 获取当前运行时实例。                       |
| [`setCurrentInstance`](/wevu/api/index/functions/setCurrentInstance)         | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance) | 设置当前运行时实例（框架层）。             |
| [`getCurrentSetupContext`](/wevu/api/index/functions/getCurrentSetupContext) | [`SetupContext`](/wevu/api/index/interfaces/SetupContext)       | 获取当前 setup context。                   |
| [`setCurrentSetupContext`](/wevu/api/index/functions/setCurrentSetupContext) | [`SetupContext`](/wevu/api/index/interfaces/SetupContext)       | 设置当前 setup context（框架层）。         |
| [`runSetupFunction`](/wevu/api/index/functions/runSetupFunction)             | [`SetupFunction`](/wevu/api/index/type-aliases/SetupFunction)   | 手动运行 setup 并绑定上下文（调试/底层）。 |

## 3. provide/inject（含全局容器）

| API                                                        | 类型入口               | 说明                            |
| ---------------------------------------------------------- | ---------------------- | ------------------------------- |
| [`provide`](/wevu/api/index/functions/provide)             | `InjectionKey<T>` 兼容 | 在当前组件树提供依赖。          |
| [`inject`](/wevu/api/index/functions/inject)               | `T \| undefined`       | 从当前组件树读取依赖。          |
| [`provideGlobal`](/wevu/api/index/functions/provideGlobal) | `Record<string, any>`  | 提供全局级依赖（跨页面/组件）。 |
| [`injectGlobal`](/wevu/api/index/functions/injectGlobal)   | `any`                  | 读取全局级依赖。                |

## 4. 推荐：通过 `ctx.instance` 操作原生实例

在 wevu 里，和小程序实例直接耦合的方法，推荐放在 `ctx.instance` 上调用，而不是依赖 `this`：

- `ctx.instance.triggerEvent(...)`
- `ctx.instance.createSelectorQuery()`
- `ctx.instance.setData(...)`
- 以及平台原生 `wx` 组件实例 API

### 示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { getCurrentSetupContext, provide, ref } from 'wevu'

// [TS-only] 此示例无专属语法，TS/JS 写法一致。
const visible = ref(false)
provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  visible.value = true
  ctx?.emit('open', { ok: true })
  ctx?.instance?.triggerEvent?.('opened', { ts: Date.now() })
}

function measure() {
  const ctx = getCurrentSetupContext()
  const query = ctx?.instance?.createSelectorQuery?.()
  query?.select('#target').boundingClientRect()
  query?.exec(console.log)
}

function patchRaw() {
  const ctx = getCurrentSetupContext()
  ctx?.instance?.setData?.({ rawFlag: true })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
  <button @tap="measure">
    measure
  </button>
  <button @tap="patchRaw">
    patchRaw
  </button>
</template>
```

```vue [JavaScript]
<script setup>
import { getCurrentSetupContext, provide, ref } from 'wevu'

const visible = ref(false)
provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  visible.value = true
  ctx?.emit('open', { ok: true })
  ctx?.instance?.triggerEvent?.('opened', { ts: Date.now() })
}

function measure() {
  const ctx = getCurrentSetupContext()
  const query = ctx?.instance?.createSelectorQuery?.()
  query?.select('#target').boundingClientRect()
  query?.exec(console.log)
}

function patchRaw() {
  const ctx = getCurrentSetupContext()
  ctx?.instance?.setData?.({ rawFlag: true })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
  <button @tap="measure">
    measure
  </button>
  <button @tap="patchRaw">
    patchRaw
  </button>
</template>
```

:::

## 5. 双向绑定辅助

| API                                                      | 类型入口                                                                                                                            | 说明                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [`useBindModel`](/wevu/api/index/functions/useBindModel) | [`ModelBindingOptions`](/wevu/api/index/interfaces/ModelBindingOptions) / [`ModelBinding`](/wevu/api/index/interfaces/ModelBinding) | 生成小程序可直接绑定的数据 + 事件处理器。 |

## 6. 相关页

- 生命周期与页面事件：[/wevu/api-reference/lifecycle](/wevu/api-reference/lifecycle)
- 运行时桥接与调试：[/wevu/api-reference/runtime-bridge](/wevu/api-reference/runtime-bridge)
