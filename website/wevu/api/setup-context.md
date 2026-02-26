---
title: Setup Context API
description: 本页严格对应 wevu 源码中的 setup 上下文相关导出（runtime/hooks.ts、runtime/provide.ts、runtime/register.ts、runtime/vueCompat.ts）。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - setup
  - context
---

# Setup Context API（setup 上下文）

`setup(props, ctx)` 的字段语义来自 `SetupContext` 类型；本页重点列出可直接导入调用的公开 API。

`ctx` 常见字段（类型定义语义）：

- `ctx.runtime`：当前 `RuntimeInstance`
- `ctx.instance`：原生小程序实例
- `ctx.emit`：事件派发函数

## 实例与上下文访问 API

### `getCurrentInstance()` {#getcurrentinstance}

- 用途：获取当前运行时实例。
- 源码：`runtime/hooks.ts`。

### `getCurrentSetupContext()` {#getcurrentsetupcontext}

- 用途：获取当前 setup context。
- 源码：`runtime/hooks.ts`。

## 依赖注入 API

### `provide()` {#provide}

- 用途：在当前组件树提供依赖。
- 源码：`runtime/provide.ts`。

### `inject()` {#inject}

- 用途：从上层读取依赖。
- 源码：`runtime/provide.ts`。

## Setup 兼容工具 API

### `useNativeInstance()` {#usenativeinstance}

- 用途：获取当前 setup 对应的原生实例。
- 源码：`runtime/vueCompat.ts`。

### `useBindModel()` {#usebindmodel}

- 用途：创建绑定 payload（`value + onXxx`）辅助函数。
- 源码：`runtime/vueCompat.ts`。

## 示例

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { getCurrentSetupContext, provide, ref, useBindModel, useNativeInstance } from 'wevu'

const visible = ref(false)
const model = useBindModel({
  prop: 'modelValue',
  event: 'update:modelValue',
})

provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  const instance = useNativeInstance()
  visible.value = true
  model.setValue?.(true)
  ctx?.emit('open', { ok: true })
  instance.triggerEvent?.('opened', { ts: Date.now() })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
</template>
```

```vue [JavaScript]
<script setup>
import { getCurrentSetupContext, provide, ref, useBindModel, useNativeInstance } from 'wevu'

const visible = ref(false)
const model = useBindModel({
  prop: 'modelValue',
  event: 'update:modelValue',
})

provide('featureFlag', 'ctx-instance-demo')

function open() {
  const ctx = getCurrentSetupContext()
  const instance = useNativeInstance()
  visible.value = true
  model.setValue?.(true)
  ctx?.emit('open', { ok: true })
  instance.triggerEvent?.('opened', { ts: Date.now() })
}
</script>

<template>
  <view id="target" @tap="open">
    open: {{ visible }}
  </view>
</template>
```

:::
