---
title: Runtime Bridge API
---

# Runtime Bridge API（桥接与调试）

这页覆盖 wevu 与小程序原生运行时之间的桥接能力，以及用于排错/调优的底层 API。

## 1. 运行时注册与挂载

| API                                                                            | 类型入口                                                                                        | 说明                         | 使用建议                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| [`mountRuntimeInstance`](/wevu/api/index/functions/mountRuntimeInstance)       | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance)                                 | 挂载并初始化运行时实例。     | 框架层/测试中使用，业务侧通常不直接调用。 |
| [`teardownRuntimeInstance`](/wevu/api/index/functions/teardownRuntimeInstance) | [`RuntimeInstance`](/wevu/api/index/interfaces/RuntimeInstance)                                 | 销毁运行时实例并清理副作用。 | 与 `mountRuntimeInstance` 成对调用。      |
| [`registerApp`](/wevu/api/index/functions/registerApp)                         | [`MiniProgramAppOptions`](/wevu/api/index/type-aliases/MiniProgramAppOptions)                   | 原生 App 注册桥接。          | 框架层接口。                              |
| [`registerComponent`](/wevu/api/index/functions/registerComponent)             | [`MiniProgramComponentRawOptions`](/wevu/api/index/type-aliases/MiniProgramComponentRawOptions) | 原生 Component 注册桥接。    | 框架层接口。                              |

## 2. 全局默认值与行为开关

| API                                                                | 类型入口                                                  | 说明                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------- |
| [`setWevuDefaults`](/wevu/api/index/functions/setWevuDefaults)     | [`WevuDefaults`](/wevu/api/index/interfaces/WevuDefaults) | 配置 `createApp/defineComponent` 默认行为。 |
| [`resetWevuDefaults`](/wevu/api/index/functions/resetWevuDefaults) | `void`                                                    | 重置默认值（测试/热更新常用）。             |
| [`markNoSetData`](/wevu/api/index/functions/markNoSetData)         | `T`                                                       | 标记对象不参与 `setData` 快照。             |
| [`isNoSetData`](/wevu/api/index/functions/isNoSetData)             | `boolean`                                                 | 判断对象是否被标记为 no-setData。           |

## 3. 调试与观测

| API                                                                          | 类型入口                                                      | 说明                   | 场景                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------- | ------------------------ |
| [`addMutationRecorder`](/wevu/api/index/functions/addMutationRecorder)       | [`MutationRecord`](/wevu/api/index/interfaces/MutationRecord) | 注册 mutation 记录器。 | 调试 state 变化来源。    |
| [`removeMutationRecorder`](/wevu/api/index/functions/removeMutationRecorder) | [`MutationRecord`](/wevu/api/index/interfaces/MutationRecord) | 移除 mutation 记录器。 | 测试结束清理。           |
| [`callHookList`](/wevu/api/index/functions/callHookList)                     | -                                                             | 顺序执行 hook 列表。   | 框架内部生命周期调度。   |
| [`callHookReturn`](/wevu/api/index/functions/callHookReturn)                 | -                                                             | 执行返回值型 hook。    | `onShareAppMessage` 等。 |
| [`callUpdateHooks`](/wevu/api/index/functions/callUpdateHooks)               | -                                                             | 执行更新类 hook。      | 渲染更新调度。           |

## 4. 编译侧常量（`wevu/compiler`）

`wevu/compiler` 主要给编译工具使用，业务代码不建议直接依赖。

| 常量/类型                    | 链接                                                                                                               | 说明                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `WE_VU_MODULE_ID`            | [/wevu/api/compiler/variables/WE_VU_MODULE_ID](/wevu/api/compiler/variables/WE_VU_MODULE_ID)                       | 运行时模块 ID（`wevu`）。       |
| `WE_VU_RUNTIME_APIS`         | [/wevu/api/compiler/variables/WE_VU_RUNTIME_APIS](/wevu/api/compiler/variables/WE_VU_RUNTIME_APIS)                 | 编译器识别的运行时 API 名单。   |
| `WE_VU_PAGE_HOOK_TO_FEATURE` | [/wevu/api/compiler/variables/WE_VU_PAGE_HOOK_TO_FEATURE](/wevu/api/compiler/variables/WE_VU_PAGE_HOOK_TO_FEATURE) | 页面 hook 与 feature 标记映射。 |
| `WevuRuntimeApiName`         | [/wevu/api/compiler/type-aliases/WevuRuntimeApiName](/wevu/api/compiler/type-aliases/WevuRuntimeApiName)           | 运行时 API 名称联合类型。       |
| `WevuPageHookName`           | [/wevu/api/compiler/type-aliases/WevuPageHookName](/wevu/api/compiler/type-aliases/WevuPageHookName)               | 页面 hook 名称联合类型。        |
| `WevuPageFeatureFlag`        | [/wevu/api/compiler/type-aliases/WevuPageFeatureFlag](/wevu/api/compiler/type-aliases/WevuPageFeatureFlag)         | 页面 feature 标记联合类型。     |

## 5. 示例：默认值 + mutation 记录（script setup）

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
// [TS-only] 参数类型注解仅支持 lang="ts"
function recorder(record: any) {
  console.log('mutation:', record.path, record.type)
}

addMutationRecorder(recorder)

function inc() {
  count.value += 1
}

onUnmounted(() => {
  removeMutationRecorder(recorder)
})
</script>

<template>
  <button @tap="inc">
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

function inc() {
  count.value += 1
}

onUnmounted(() => {
  removeMutationRecorder(recorder)
})
</script>

<template>
  <button @tap="inc">
    count: {{ count }}
  </button>
</template>
```

:::
