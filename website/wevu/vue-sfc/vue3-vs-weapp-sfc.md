---
title: Vue 3 SFC vs Weapp-vite SFC：写法对比
description: 本文聚焦“写法层面”的相同与不同：当你用 Weapp-vite + Wevu 写 .vue 时，哪些与 Vue 3 SFC
  一致，哪些会因为小程序编译/运行时而发生变化。
keywords:
  - Weapp-vite
  - Wevu
  - 微信小程序
  - 运行时
  - 编译
  - vue
  - sfc
  - Vue 3
---

# Vue 3 SFC vs Weapp-vite SFC：写法对比

本文聚焦“写法层面”的相同与不同：当你用 Weapp-vite + Wevu 写 `.vue` 时，哪些与 Vue 3 SFC 一致，哪些会因为小程序编译/运行时而发生变化。

## 相同点（写法层面）

- **SFC 结构一致**：`<template>` / `<script setup>` / `<script>` / `<style>` 这些块仍然是主入口。
- **Composition API 语法一致**：`ref` / `reactive` / `computed` / `watch` / `onMounted` 等写法保持 Vue 3 心智。
- **`setup(props, ctx)` 签名一致**：`props` 与 `ctx` 仍是第一、第二参数，SFC 可以同时写 Options API 与 Composition API。
- **Script Setup 宏一致**：`defineProps` / `defineEmits` / `defineExpose` / `defineSlots` / `defineModel` 等宏仍可用（主要用于类型与编译期消解）。

## 不同点（由小程序编译/运行时造成）

### 1. 模板目标不是 DOM，而是 WXML

- 模板会被编译成 WXML，标签与属性遵循小程序规范（如 `view` / `text` / `image`）。
- 事件名会被映射到小程序事件（例如 `@click` 会映射为 `bindtap`）。
- `v-model` 会被编译成小程序事件 + 数据集路径（`bindinput="__weapp_vite_model"` + `data-wv-model="..."`），并只对部分表单元素有专门映射。
- `v-bind="object"` 不会展开为属性，需要显式写 `:prop="..."`。

细节参考：`/wevu/vue-sfc/template`。

### 2. 组件注册方式不同：usingComponents 仍是最终产物

Vue 3 中常见写法是“import + 注册/自动注册”。小程序最终仍要求 **JSON 声明式** 的 `usingComponents`，但 Weapp-vite 支持在**编译期**把“import + 模板使用”转为 `usingComponents`，因此可以保留类似的写法心智。

在 Weapp-vite 中：

- `usingComponents` 可以写在 `<json>` 或 `definePageJson/defineComponentJson` 宏里。
- 编译器会从 **模板标签** 与 **`<script setup>` 导入** 自动补齐 `usingComponents`（编译期生成，不是运行时注册）。
- 对应的组件导入会被移除，仅作为编译期元信息使用。

细节参考：`/wevu/vue-sfc/config`。

### 3. 新增 `<json>` 与 JSON 宏（Vue 3 没有）

Weapp-vite 允许在 `.vue` 中直接写小程序配置：

- `<json>` 自定义块（支持 json/jsonc/json5）。
- `<script setup>` 中的 `defineAppJson / definePageJson / defineComponentJson`（构建期执行并合并到最终 JSON）。

这些配置最终生成 `app.json / page.json / component.json`，属于小程序必需产物。

### 4. 运行时来源是 Wevu（而非 vue）

SFC 运行时基于 **Wevu**，不是浏览器 DOM：

- `defineComponent`、`ref` 等 API 应从 `wevu` 导入。
- Weapp-vite 会把部分 `vue` 运行时 API 重写为 `wevu` 版本（如 `useAttrs` / `useSlots` / `useModel`）。
- `ctx.emit` 实际调用的是小程序 `triggerEvent`，只携带 `detail` 单一载荷。

### 5. 样式输出是 WXSS，scoped 规则不同

- `<style>` 会编译为 WXSS，支持 `lang` 与 `scoped` / CSS Modules，但输出受 WXSS 规则限制。
- `scoped` 通过注入属性选择器实现（`data-v-xxx`），不是 DOM 级别的作用域计算。
- class/style 绑定会注入运行时代码（JS/WXS）以适配小程序模板能力。

## 快速对照示例

Vue 3（Web）：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import MyCard from './MyCard.vue'

const count = ref(0)
</script>

<template>
  <MyCard :count="count" @click="count++" />
</template>
```

Weapp-vite + Wevu（小程序）：

```vue
<script setup lang="ts">
import { ref } from 'wevu'
import MyCard from './MyCard.vue'

// 编译期会根据 import + 模板使用自动生成 usingComponents
const count = ref(0)
</script>

<template>
  <MyCard :count="count" @click="count++" />
</template>
```

## 实用总结

- **“写法像 Vue 3，产物是小程序”**：语法趋同，但目标平台完全不同。
- **优先认清两层**：模板/配置在编译期解决，响应式与生命周期在 Wevu 运行期解决。
- **遇到问题先分层**：模板/指令 → 看 Weapp-vite 编译；状态/生命周期 → 看 Wevu 运行时。
