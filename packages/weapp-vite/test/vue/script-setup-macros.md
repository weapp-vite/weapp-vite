# Vue `<script setup>` 宏/组合式 API 支持情况（weapp-vite + wevu）

本文聚焦 `weapp-vite` 对 Vue 3 `<script setup>` 宏（macros）及部分组合式 API 的**当前支持状态**，用于判断「能不能用 / 需要注意什么 / 有什么替代方案」。

> 背景：`weapp-vite` 使用 `vue/compiler-sfc` 的 `compileScript()` 编译 `<script setup>`，随后对产物做 AST 转换并注册为 `wevu` 组件。

## 总览

- ✅ 完整支持（含语义稳定）：`defineProps()`、`withDefaults()`、`defineEmits()`、`defineExpose()`、`defineOptions()`
- ⚠️ 部分支持（可用但有边界）：`defineModel()`、`useModel()`、`defineSlots()`、`useSlots()`、`useAttrs()`
- ❌ 无法等价支持：Web Vue 的运行时 slot 函数语义（`useSlots()` 返回可调用插槽函数）

## 完整支持矩阵（编译期宏）

| 宏                | 支持情况    | 当前行为                                                                  | 建议                                                |
| ----------------- | ----------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `defineProps()`   | ✅ 支持     | 由 Vue SFC 编译器生成 `props`，`wevu` 运行时映射到小程序 `properties`     | 正常使用                                            |
| `withDefaults()`  | ✅ 支持     | 由 Vue SFC 编译器处理默认值推导并产出 `props` 默认值逻辑                  | 与 `defineProps` 搭配使用                           |
| `defineEmits()`   | ✅ 支持     | `setup(_, { emit })` 注入 `emit`（封装小程序 `triggerEvent`）             | 事件载荷按小程序 `detail` 语义使用                  |
| `defineExpose()`  | ✅ 支持     | 编译后调用 `setup` context 的 `expose()`，写入运行时暴露对象              | 正常使用                                            |
| `defineOptions()` | ✅ 支持     | 组件静态选项会被保留并合并（如 `name`、`inheritAttrs`、小程序 `options`） | `props/emits/expose/slots` 仍用对应宏               |
| `defineModel()`   | ⚠️ 部分支持 | 编译后依赖 `useModel/mergeModels`；`set` 时派发 `update:xxx`              | 关注小程序事件 `detail` 与 Vue `emit(...args)` 差异 |
| `defineSlots()`   | ⚠️ 部分支持 | 编译通过并产出 `useSlots()` 调用，类型层可用                              | 不要依赖 Web Vue 的 slot 函数运行时语义             |

## 完整支持矩阵（运行时 helper）

| API                | 支持情况    | 当前行为                                                                                 | 建议                                     |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| `useModel()`       | ⚠️ 部分支持 | 返回可读写模型 ref；写入时触发 `emit('update:xxx', detail)`                              | 用于小程序双向绑定场景                   |
| `mergeModels()`    | ✅ 支持     | 合并模型声明（数组去重、对象合并）                                                       | 正常使用                                 |
| `useAttrs()`       | ⚠️ 部分支持 | 返回 `setup` ctx `attrs`；受小程序 attribute 透传限制，未声明 attrs 可能缺失或更新不稳定 | 业务关键数据改为显式 `props`             |
| `useSlots()`       | ⚠️ 部分支持 | 在小程序运行时返回空对象兜底，不提供 Web Vue `slots.xxx()` 可调用插槽函数语义            | 仅可用于“有无能力探测”，不要承载业务逻辑 |
| `useTemplateRef()` | ✅ 支持     | 提供模板 ref 映射能力（wevu runtime 实现）                                               | 正常使用                                 |

## 关键细节

### 1) `defineExpose()` 在 wevu 中的语义

- Vue 侧：`defineExpose({ ... })` 会变成对 `setup` context 的 `expose()` 调用。
- wevu 侧：`setup(_, { expose })` 的 `expose()` 会把数据写入内部 `__wevuExposed`，并在默认导出/实例导出时被使用（运行时会做合并策略）。

### 2) 关于 `defineModel()` / `defineSlots()` 的实现边界

Vue SFC 编译器会把它们转换为对 `'vue'` 的运行时依赖（示例为精简后的编译产物形态）：

- `defineModel()` → `import { useModel, mergeModels } from 'vue'`
- `defineSlots()` → `import { useSlots } from 'vue'`

weapp-vite 会将这些导入迁移到 `wevu`，并由 `wevu` 提供对应的兼容实现；其中 `useSlots` 在小程序场景为兜底空对象，`useModel` 主要负责在 `set` 时派发 `update:xxx` 事件；`useAttrs` 会基于运行时 `properties` 推导非 props 属性，但覆盖范围仍受小程序 attribute 传递能力限制。

### 3) `defineOptions()` 的适用范围

- 仅用于无法通过宏/Composition API 表达的组件静态选项（如 `name`、`inheritAttrs`）。
- 小程序原生 `Component` 选项请放在 `options` 字段中（如 `multipleSlots/styleIsolation/virtualHost`）。
- `props/emits/expose/slots` 仍应使用 `defineProps/defineEmits/defineExpose/defineSlots`。

### 4) `useAttrs()` 在小程序的限制（重要）

- `useAttrs()` 在 wevu 中属于“尽力兼容”，不是 Web Vue 语义的完整复刻。
- 小程序运行时不会像 Web DOM 那样稳定地透传/同步所有未声明 attributes，尤其是业务运行中的动态变更场景。
- 因此若依赖“未声明 attrs 的可观测更新”，在小程序里通常不可靠。

推荐做法：

- 业务关键输入使用显式 `props`（`defineProps`）。
- 跨层共享状态使用 `provide/inject` 或 store。
- `attrs/useAttrs` 仅用于弱依赖的展示型透传、调试信息或兜底显示。

### 5) `defineSlots()` / `useSlots()` 在小程序的限制（重要）

- `defineSlots()` 在 weapp-vite + wevu 中主要提供类型声明与编译链路兼容。
- 小程序运行时没有 Web Vue 那样的运行时 slot 函数映射，`useSlots()` 当前返回空对象兜底。
- 因此不要依赖 `slots.default?.()`、`slots.xxx?.(props)` 这类运行时函数调用来驱动业务逻辑。

推荐做法：

- 把 slot 当作模板能力使用（`<slot />` / `<slot name="x" />`）。
- 业务控制流放在显式 `props`、`emit`、`provide/inject` 或 store 上。

## 示例

### 组件侧：`defineModel()` + `defineSlots()` + `useAttrs/useSlots`

```vue
<script setup lang="ts">
import { useAttrs, useSlots } from 'vue'

const slots = defineSlots<{ default?: () => any }>()
const model = defineModel<string>()
const attrs = useAttrs()
const runtimeSlots = useSlots()

function onInput(e: any) {
  model.value = e?.detail?.value ?? ''
}

defineExpose({ model, attrs, slots, runtimeSlots })
</script>
```

### 父组件侧：监听 `update:modelValue`

> 推荐使用“函数调用”形式的事件表达式（例如 `onModelUpdate($event)`），以匹配当前内联事件处理的能力边界。

```vue
<script setup lang="ts">
import { ref } from 'wevu'

const text = ref('hello')
function onModelUpdate(event: any) {
  text.value = event?.detail ?? ''
}
</script>

<template>
  <define-model-child
    :model-value="text"
    @update:modelValue="onModelUpdate($event)"
  />
</template>
```

## 相关实现位置（便于追踪）

- `<script setup>` 编译入口：`packages/wevu-compiler/src/plugins/vue/transform/compileVueFile/index.ts`
- 编译产物后处理（含 expose 对齐）：`packages/wevu-compiler/src/plugins/vue/transform/script.ts`
- wevu `setup` context（`emit/expose/attrs/slots`）：`packages/wevu/src/runtime/register.ts`
- wevu 兼容 helper（`useAttrs/useSlots/useModel`）：`packages/wevu/src/runtime/vueCompat.ts`
