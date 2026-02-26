---
title: Core API
description: 本页聚焦 Wevu 的“最先接触”能力：应用入口、组件定义、 宏，以及模板辅助函数。
keywords:
  - Wevu
  - Vue SFC
  - api
  - reference
  - core
  - 本页聚焦
  - 的“最先接触”能力：应用入口
  - 组件定义
---

# Core API（入口、组件、宏）

本页聚焦 `wevu` 的“最先接触”能力：应用入口、组件定义、`<script setup>` 宏，以及模板辅助函数。

## 1. 入口与组件定义

| API                             | 类型入口                                         | 说明                                                 |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `createApp`                     | `CreateAppOptions` / `RuntimeApp`                | 创建并注册小程序 App，桥接全局生命周期。             |
| `defineComponent`               | `DefineComponentOptions` / `ComponentDefinition` | 定义页面或组件（统一注册为 `Component()`）。         |
| `createWevuComponent`           | `MiniProgramComponentOptions`                    | 编译产物专用入口，保留小程序字段并接入 Wevu 运行时。 |
| `createWevuScopedSlotComponent` | `MiniProgramComponentOptions`                    | scoped-slot 场景的兼容组件构造器。                   |
| `registerApp`                   | `MiniProgramAppOptions`                          | 底层 App 注册桥接（调试/框架层更常用）。             |
| `registerComponent`             | `MiniProgramComponentRawOptions`                 | 底层 Component 注册桥接。                            |

## 2. `<script setup>` 宏

这些 API 主要用于 SFC 编译阶段，运行时多数会被擦除或改写。建议和 `weapp-vite/volar` 一起使用以获得更完整类型提示。

| API             | 类型入口                                     | 说明                                                    |
| --------------- | -------------------------------------------- | ------------------------------------------------------- |
| `defineProps`   | `ComponentPropsOptions` / `ExtractPropTypes` | 声明 props（对象写法或泛型写法）。                      |
| `withDefaults`  | `ExtractDefaultPropTypes`                    | 给类型化 props 设置默认值。                             |
| `defineEmits`   | `EmitsOptions` / `TriggerEventOptions`       | 声明 emit，支持数组、对象、函数签名、named tuple 泛型。 |
| `defineSlots`   | `VNode`                                      | 声明 slots 类型。                                       |
| `defineExpose`  | `ComponentPublicInstance`                    | 暴露实例字段给父组件引用。                              |
| `defineModel`   | `ModelBinding`                               | 定义 `v-model` 对应模型（含默认键）。                   |
| `defineOptions` | `MiniProgramComponentOptions`                | 在 `<script setup>` 中声明组件选项。                    |
| `mergeModels`   | `ModelBindingPayload`                        | 合并多路 model 绑定结果。                               |
| `useModel`      | `ModelBinding`                               | 运行时读取/写入某个 model。                             |

### 宏能力示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { useTemplateRef } from 'wevu'

// [TS-only] interface 类型声明仅支持 lang="ts"
interface Props {
  title?: string
  modelValue: number
}

// [TS-only] defineProps 泛型写法仅支持 lang="ts"
const props = withDefaults(defineProps<Props>(), {
  title: '默认标题',
})

// [TS-only] defineEmits 泛型（含 named tuple）仅支持 lang="ts"
const emit = defineEmits<{
  'submit': [value: string]
  'update:modelValue': [value: number]
}>()

// [TS-only] defineModel 泛型仅支持 lang="ts"
const model = defineModel<number>()
const inputRef = useTemplateRef('input')

// [TS-only] 参数类型注解仅支持 lang="ts"
function onSubmit(value: string) {
  emit('submit', value)
  emit('update:modelValue', model.value ?? 0)
  console.log(props.title, inputRef.value)
}

defineExpose({ onSubmit })
</script>
```

```vue [JavaScript]
<script setup>
import { useTemplateRef } from 'wevu'

const props = defineProps({
  title: String,
  modelValue: Number,
})

const emit = defineEmits(['submit', 'update:modelValue'])
const model = defineModel()
const inputRef = useTemplateRef('input')

function onSubmit(value) {
  emit('submit', value)
  emit('update:modelValue', model.value ?? 0)
  console.log(props.title, inputRef.value)
}

defineExpose({ onSubmit })
</script>
```

:::

## 3. 模板和 class/style 工具

| API              | 类型入口                           | 说明                                    |
| ---------------- | ---------------------------------- | --------------------------------------- |
| `useAttrs`       | `SetupContext`                     | 获取 attrs（透传属性）。                |
| `useSlots`       | `TemplateRefs`                     | 获取 slots。                            |
| `useTemplateRef` | `TemplateRef` / `TemplateRefValue` | 获取模板 `ref` 对应实例。               |
| `normalizeClass` | `string`                           | 归一化 class 输入（对象/数组/字符串）。 |
| `normalizeStyle` | `Record<string, string>`           | 归一化 style 输入。                     |

### 模板工具示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { computed, normalizeClass, normalizeStyle, useAttrs, useSlots } from 'wevu'

// [TS-only] 此示例无专属语法，TS/JS 写法一致。
const attrs = useAttrs()
const slots = useSlots()
const isActive = true

const className = computed(() => normalizeClass(['card', { active: isActive }]))
const styleText = computed(() => normalizeStyle([{ color: '#1f2937', fontWeight: 600 }]))
</script>

<template>
  <view :class="className" :style="styleText" v-bind="attrs">
    <slot v-if="slots.default" />
  </view>
</template>
```

```vue [JavaScript]
<script setup>
import { computed, normalizeClass, normalizeStyle, useAttrs, useSlots } from 'wevu'

const attrs = useAttrs()
const slots = useSlots()
const isActive = true

const className = computed(() => normalizeClass(['card', { active: isActive }]))
const styleText = computed(() => normalizeStyle([{ color: '#1f2937', fontWeight: 600 }]))
</script>

<template>
  <view :class="className" :style="styleText" v-bind="attrs">
    <slot v-if="slots.default" />
  </view>
</template>
```

:::

## 4. 相关页

- 响应式能力：[/wevu/api-reference/reactivity](/wevu/api-reference/reactivity)
- setup 上下文与原生实例：[/wevu/api-reference/setup-context](/wevu/api-reference/setup-context)
- 完整函数索引：/wevu/api/
