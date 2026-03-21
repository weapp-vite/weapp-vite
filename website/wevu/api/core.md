---
title: Core API
description: 本页聚焦 Wevu 的入口能力、组件定义、script setup 宏与模板工具，采用逐 API 讲解结构。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - reference
  - core
---

# Core API（入口、组件、宏）

本页覆盖 `wevu` 中最先接触的一组 API：应用入口、组件定义、`<script setup>` 宏与模板工具。每个 API 单独成段，便于按需跳转。

## 入口与组件定义

### `createApp()` {#createapp}

- 类型入口：`CreateAppOptions` / `RuntimeApp`
- 用途：创建并注册小程序 App 运行时入口。
- 说明：通常在 App 侧只调用一次。

### `defineComponent()` {#definecomponent}

- 类型入口：`DefineComponentOptions` / `ComponentDefinition`
- 用途：定义页面/组件并接入 Wevu 生命周期与响应式。
- 说明：Wevu 统一使用 `Component()` 模型。

## Script Setup 宏

### `defineProps()` {#defineprops}

- 类型入口：`ComponentPropsOptions` / `ExtractPropTypes`
- 用途：声明组件 props。
- 说明：支持对象写法与 TS 泛型写法。

### `withDefaults()` {#withdefaults}

- 类型入口：`ExtractDefaultPropTypes`
- 用途：给类型化 props 设置默认值。
- 说明：通常与 `defineProps<T>()` 配套。

### `defineEmits()` {#defineemits}

- 类型入口：`EmitsOptions` / `TriggerEventOptions`
- 用途：声明事件与参数类型。
- 说明：支持对象/数组/泛型（含 named tuple）。

### `defineSlots()` {#defineslots}

- 类型入口：`VNode`
- 用途：声明 slots 类型。

### `defineExpose()` {#defineexpose}

- 类型入口：`ComponentPublicInstance`
- 用途：显式暴露实例字段。

### `defineModel()` {#definemodel}

- 类型入口：`ModelBinding`
- 用途：声明 `v-model` 绑定。

### `defineOptions()` {#defineoptions}

- 类型入口：`MiniProgramComponentOptions`
- 用途：在 `<script setup>` 中定义组件配置项。
- Behavior 说明：可直接声明 `behaviors`。当条目来自原生 `Behavior()` 返回值时，编译阶段会保留该表达式并继续后续转换。

### `mergeModels()` {#mergemodels}

- 类型入口：`ModelBindingPayload`
- 用途：合并多路 model 绑定结果。

### `useModel()` {#usemodel}

- 类型入口：`ModelBinding`
- 用途：运行时读取/写入某个 model。

## 模板工具

### `useAttrs()` {#useattrs}

- 类型入口：`SetupContext`
- 用途：获取透传属性 attrs。

### `useSlots()` {#useslots}

- 类型入口：`TemplateRefs`
- 用途：读取 slots。

### `useTemplateRef()` {#usetemplateref}

- 类型入口：`TemplateRef` / `TemplateRefValue`
- 用途：读取模板 ref 对应实例。

### `useNativeInstance()` {#usenativeinstance}

- 类型入口：`SetupContextNativeInstance`
- 用途：在 setup 中访问原生页面/组件实例。

### `useNativeRouter()` {#usenativerouter}

- 类型入口：`WechatMiniprogram.Component.Router`
- 用途：获取组件路径语义的路由器对象。
- 说明：优先命中实例 `router`，然后回退 `pageRouter`，低版本基础库再降级到全局 `wx/my/tt` 路由方法。

### `useNativePageRouter()` {#usenativepagerouter}

- 类型入口：`WechatMiniprogram.Component.Router`
- 用途：获取页面路径语义的路由器对象。
- 说明：优先命中实例 `pageRouter`，然后回退 `router`，低版本基础库再降级到全局 `wx/my/tt` 路由方法。

### `normalizeClass()` {#normalizeclass}

- 类型入口：`string`
- 用途：归一化 class 输入（对象/数组/字符串）。

### `normalizeStyle()` {#normalizestyle}

- 类型入口：`string`
- 用途：归一化 style 输入。

## 示例

### 宏能力示例（script setup）

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { useTemplateRef } from 'wevu'

interface Props {
  title?: string
  modelValue: number
}

const props = withDefaults(defineProps<Props>(), {
  title: '默认标题',
})

const emit = defineEmits<{
  'submit': [value: string]
  'update:modelValue': [value: number]
}>()

const model = defineModel<number>()
const inputRef = useTemplateRef('input')

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

const props = defineProps({ title: String, modelValue: Number })
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
