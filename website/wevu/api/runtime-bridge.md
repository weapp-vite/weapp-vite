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

## 页面布局桥接

### `setPageLayout()` / `usePageLayout()` {#pagelayout}

- 类型入口：`PageLayoutState` / `WevuPageLayoutMap`
- 用途：在运行时读取或切换页面 layout。
- 说明：通常由 Weapp-vite 的 `definePageMeta({ layout })`、`routeRules.layout` 先确定初始 layout；业务侧只在需要运行时切换页面壳时调用。

### `registerPageLayoutBridge()` / `unregisterPageLayoutBridge()` {#pagelayoutbridge}

- 类型入口：`LayoutBridgeInstance`
- 用途：注册页面 layout 桥接实例。
- 说明：主要给 Weapp-vite layout 运行时与框架集成使用，业务工程通常不需要直接调用。

### `registerRuntimeLayoutHosts()` / `unregisterRuntimeLayoutHosts()` {#layouthosts}

- 类型入口：`LayoutHostBinding`
- 用途：注册 layout host 映射，供页面运行时定位当前页面壳。
- 说明：属于框架集成层 API；业务侧优先使用 `setPageLayout()`。

### `useLayoutBridge()` / `useLayoutHosts()` {#uselayoutbridge}

- 类型入口：`LayoutBridgeInstance` / `LayoutHostBinding`
- 用途：读取当前 layout bridge 或 host 绑定。
- 说明：用于 layout 组件、调试页和框架扩展，不建议普通页面直接依赖。

### `resolveLayoutBridge()` {#resolvelayoutbridge}

- 类型入口：`LayoutBridgeInstance`
- 用途：解析当前页面已注册的 layout bridge。
- 适合：需要在业务 hook 中统一访问 layout 内部宿主能力时，先定位承载宿主组件的 layout 上下文。
- 说明：普通业务页面优先使用更直接的 `resolveLayoutHost()`；只有需要自己调用 `selectComponent()` 或做兼容兜底时再使用 bridge。

### `resolveLayoutHost()` / `waitForLayoutHost()` {#resolvelayouthost}

- 类型入口：`LayoutHostResolveOptions`
- 用途：按 `layout-host` key 解析 layout 内暴露的宿主组件实例。
- 适合：Toast、Dialog、全局反馈层、抽屉等天然属于 layout 的组件。
- 说明：`resolveLayoutHost()` 同步返回当前可用实例；`waitForLayoutHost()` 会按短间隔重试，适合页面初次进入时等待 layout 宿主完成挂载。

示例：

```vue
<script setup lang="ts">
import { resolveLayoutHost } from 'wevu'

interface ToastHost {
  show: (options: { message: string }) => void
}

function showSuccess() {
  const toast = resolveLayoutHost<ToastHost>('layout-toast')
  toast?.show({ message: '操作成功' })
}
</script>
```

## 子路径边界

- `wevu/compiler` 不是 `wevu` 根入口的一部分，主要给编译工具使用。
- `wevu/router` 也不是运行时桥接页的一部分；若你需要 `createRouter()` / `useRouter()`，请直接看 [/wevu/router](/wevu/router)。
- `wevu/fetch` 与 `wevu/web-apis` 是网络/Web API 兼容入口；分别看 [/wevu/fetch](/wevu/fetch) 与 Web runtime 相关说明。

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
