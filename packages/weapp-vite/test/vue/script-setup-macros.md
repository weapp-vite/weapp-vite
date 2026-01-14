# Vue `<script setup>` 宏/组合式 API 支持情况（weapp-vite + wevu）

本文聚焦 `weapp-vite` 对 Vue 3 `<script setup>` 宏（macros）及部分组合式 API 的**当前支持状态**，用于判断「能不能用 / 需要注意什么 / 有什么替代方案」。

> 背景：`weapp-vite` 使用 `vue/compiler-sfc` 的 `compileScript()` 编译 `<script setup>`，随后对产物做 AST 转换并注册为 `wevu` 组件。

## 总览

- ✅ 支持：`defineProps()`、`defineEmits()`、`defineModel()`、`defineExpose()`、`defineOptions()`、`defineSlots()`、`useSlots()`、`useAttrs()`

## 支持矩阵

| API / 宏          | 支持情况 | 说明（重点）                                                                                                                                  | 参考 / 替代方案                                                      |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `defineProps()`   | ✅ 支持  | 由 Vue SFC 编译器生成 `props` 选项，`wevu` 运行时会映射为小程序 `properties`                                                                  | 正常使用 `defineProps` / `withDefaults`                              |
| `defineEmits()`   | ✅ 支持  | 由 Vue SFC 编译器生成 `emits` 选项，`setup(_, { emit })` 会注入 `emit`（小程序 `triggerEvent` 包装）                                          | 事件载荷为 `detail`（与 Vue `emit(...args)` 不同）                   |
| `defineExpose()`  | ✅ 支持  | Vue 编译产物为 `setup(_, { expose: __expose }) { __expose({ ... }) }`；`weapp-vite` 会将其对齐为 `setup(_, { expose }) { expose({ ... }) }`   | `packages/weapp-vite/src/plugins/vue/transform/transformScript.ts`   |
| `defineOptions()` | ✅ 支持  | Vue 编译产物为组件选项对象 spread（如 `{ ...{ name, inheritAttrs } }`），会被保留；`props/emits/expose/slots` 请用对应宏                      | 注意：`inheritAttrs` 在小程序场景语义有限                            |
| `defineModel()`   | ✅ 支持  | Vue 编译产物会引入 `useModel` / `mergeModels`，`weapp-vite` 会将它们迁移到 `wevu`；`useModel()` 会在 `set` 时触发 `emit('update:xxx', value)` | 注意：小程序事件载荷为 `detail`；props 的响应式语义与 Vue 不完全一致 |
| `defineSlots()`   | ✅ 支持  | Vue 编译产物会调用 `useSlots()`，`weapp-vite` 会将其迁移到 `wevu`                                                                             | 当前为小程序场景兜底实现：返回空对象（不提供 VDOM slots 语义）       |
| `useSlots()`      | ✅ 支持  | 通过 wevu 兼容实现提供（小程序场景兜底为空对象）                                                                                              | 若业务依赖 slots 函数行为，需自行抽象                                |
| `useAttrs()`      | ✅ 支持  | 通过 wevu 兼容实现提供（返回 `setup` ctx 的 `attrs`，小程序场景兜底为空对象）                                                                 | 推荐优先用 `setup(_, { attrs })`（语义更清晰）                       |

## 关键细节

### 1) `defineExpose()` 在 wevu 中的语义

- Vue 侧：`defineExpose({ ... })` 会变成对 `setup` context 的 `expose()` 调用。
- wevu 侧：`setup(_, { expose })` 的 `expose()` 会把数据写入内部 `__wevuExposed`，并在默认导出/实例导出时被使用（运行时会做合并策略）。

### 2) 关于 `defineModel()` / `defineSlots()` 的实现边界

Vue SFC 编译器会把它们转换为对 `'vue'` 的运行时依赖（示例为精简后的编译产物形态）：

- `defineModel()` → `import { useModel, mergeModels } from 'vue'`
- `defineSlots()` → `import { useSlots } from 'vue'`

weapp-vite 会将这些导入迁移到 `wevu`，并由 `wevu` 提供对应的兼容实现；其中 `useSlots/useAttrs` 为小程序场景兜底（空对象语义），`useModel` 主要负责在 `set` 时派发 `update:xxx` 事件。

### 3) `defineOptions()` 的适用范围

- 仅用于无法通过宏/Composition API 表达的组件静态选项（如 `name`、`inheritAttrs`）。
- 小程序原生 `Component` 选项请放在 `options` 字段中（如 `multipleSlots/styleIsolation/virtualHost`）。
- `props/emits/expose/slots` 仍应使用 `defineProps/defineEmits/defineExpose/defineSlots`。

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

- `<script setup>` 编译入口：`packages/weapp-vite/src/plugins/vue/transform/compileVueFile.ts`
- 编译产物后处理（含 expose 对齐）：`packages/weapp-vite/src/plugins/vue/transform/transformScript.ts`
- wevu `setup` context（`emit/expose/attrs`）：`packages/wevu/src/runtime/register.ts`
