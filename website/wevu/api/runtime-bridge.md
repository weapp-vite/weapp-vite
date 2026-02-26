---
title: Runtime Bridge API
description: 本页仅展示面向业务与配置层的 Wevu 运行时 API。框架内部桥接函数不会在文档中展开。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - reference
  - runtime
---

# Runtime Bridge API（运行时配置）

本页聚焦可在业务工程中直接使用的运行时能力。内部注册与调度函数已从文档目录中移除。

## 全局默认值

### `setWevuDefaults()` {#setwevudefaults}

- 类型入口：`WevuDefaults`
- 用途：配置 `createApp/defineComponent` 的默认行为。

### `resetWevuDefaults()` {#resetwevudefaults}

- 类型入口：`void`
- 用途：重置默认配置。
- 场景：测试隔离、开发调试。

## setData 排除标记

### `markNoSetData()` {#marknosetdata}

- 类型入口：`<T>(value: T) => T`
- 用途：标记对象不参与 `setData` 快照同步。

### `isNoSetData()` {#isnosetdata}

- 类型入口：`boolean`
- 用途：判断对象是否被标记为 no-setData。

## 调试记录

### `addMutationRecorder()` {#addmutationrecorder}

- 类型入口：`MutationRecord`
- 用途：注册状态 mutation 记录器。

### `removeMutationRecorder()` {#removemutationrecorder}

- 类型入口：`MutationRecord`
- 用途：移除状态 mutation 记录器。

## 示例

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import {
  addMutationRecorder,
  onUnmounted,
  ref,
  removeMutationRecorder,
  setWevuDefaults,
} from 'wevu'

setWevuDefaults({
  component: {
    options: {
      addGlobalClass: true,
    },
  },
})

const count = ref(0)

function recorder(record: any) {
  console.log('mutation:', record.path, record.type)
}

addMutationRecorder(recorder)

onUnmounted(() => {
  removeMutationRecorder(recorder)
})
</script>

<template>
  <button @tap="count += 1">
    count: {{ count }}
  </button>
</template>
```

```vue [JavaScript]
<script setup>
import {
  addMutationRecorder,
  onUnmounted,
  ref,
  removeMutationRecorder,
  setWevuDefaults,
} from 'wevu'

setWevuDefaults({
  component: {
    options: {
      addGlobalClass: true,
    },
  },
})

const count = ref(0)

function recorder(record) {
  console.log('mutation:', record.path, record.type)
}

addMutationRecorder(recorder)

onUnmounted(() => {
  removeMutationRecorder(recorder)
})
</script>

<template>
  <button @tap="count += 1">
    count: {{ count }}
  </button>
</template>
```

:::
