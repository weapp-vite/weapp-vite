---
title: Vue SFC 开发指南
---

# 在 weapp-vite 中使用 Vue SFC

weapp-vite 内置了 Vue SFC 编译链路，配合 `wevu` 运行时即可用 Vue 风格开发小程序页面/组件，同时保持小程序能力（页面特性、分享、性能优化）。

> 适用版本：Vue SFC 仅在 `weapp-vite@6.x` 及以上可用，请先升级到 6 大版本。

## 安装准备

- 需要安装 wevu（任意包管理器均可 `add/install wevu`）。
- 官方模板已默认带上，手动集成时请先装依赖再继续。

## 基础范式

- `wevu` 提供运行时：`defineComponent`（页面/组件统一使用，页面能力通过 `features` 声明）、`ref/reactive/computed/watch`、生命周期等。
- SFC `<config>` 块承载小程序 App/Page/Component 配置，配合 `weapp-vite/volar` 获得智能提示。
- 模板语法与 Vue 3 基本一致（事件、v-if/v-for/class/style 绑定），构建时转为小程序原生 WXML。
- 样式使用 `<style lang="scss|less|css">`，构建后输出 `wxss`。
- 组件引入沿用小程序约定：在 `<config>` 的 `usingComponents` 中声明，脚本里不要用 ESModule `import` 引入组件。
- props 推荐：wevu 会把 Vue 风格的 `props` 规范化为小程序 `properties`，原生 `properties` 亦兼容。

## .vue 编写注意事项（示例前必看）

- `<script lang="ts">`：页面请使用 `export default defineComponent({ features: {...}, setup() {...} })` 注册并通过 `features` 声明页面特性（如 `listenPageScroll`、`enableShareAppMessage`）；组件使用 `defineComponent(...)`，推荐写 `props`（wevu 会转为小程序 `properties`），并在 `setup()` 里返回/暴露模板需要的数据与方法。
- `<script setup lang="ts">`：组合式语法糖，顶层定义的 ref/computed/函数会自动暴露到模板；如需声明 props/emits 使用 `defineProps/defineEmits`。若页面需要开启特性或显式控制注册方式，仍推荐切换回常规 `<script>` 写法配合 `defineComponent({ features: ... })`。
- 运行时 API 请从 `wevu` 导入（`ref/reactive/computed/watch`、生命周期钩子等），确保挂载到小程序生命周期与 `setData` diff。
- `<config>` 块是必需的页面/组件配置入口，`usingComponents` 里登记子组件路径，脚本侧不要通过 `import` 注册小程序组件。
- 避免直接使用 `window/document` 等浏览器专属能力，需改用微信小程序 API；模板事件使用小程序事件名（`@tap` 等）。

## 页面示例：计数 + 分享 + 页面滚动

```vue
<!-- pages/counter/index.vue -->
<script lang="ts">
import { computed, defineComponent, onPageScroll, onShareAppMessage, ref } from 'wevu'

export default defineComponent({
  features: {
    listenPageScroll: true,
    enableShareAppMessage: true,
  },
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)
    const reachedTop = ref(true)

    onPageScroll(({ scrollTop }) => {
      reachedTop.value = scrollTop < 40
    })

    onShareAppMessage(() => ({
      title: `当前计数 ${count.value}`,
      path: '/pages/counter/index',
    }))

    return { count, doubled, reachedTop, inc: () => count.value++ }
  },
})
</script>

<template>
  <view class="page">
    <text>count: {{ count }} / doubled: {{ doubled }}</text>
    <text v-if="!reachedTop">
      正在滚动...
    </text>
    <button @tap="inc">
      +1
    </button>
  </view>
</template>

<config lang="jsonc">
{
  "$schema": "https://vite.icebreaker.top/page.json",
  "navigationBarTitleText": "计数器"
}
</config>
```

> 提示：tsconfig.app.json 已预置 `"vueCompilerOptions.plugins": ["weapp-vite/volar"]`，配合 Volar 扩展即可获得 `<config>` 与模板提示。

## 组件示例：Props + Emits + v-model

```vue
<!-- components/Stepper/index.vue -->
<script lang="ts">
import { computed, defineComponent, ref, watch } from 'wevu'

export default defineComponent({
  props: {
    value: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 10 },
  },
  // v-model 事件约定：weapp-vite 会把 v-model 编译为 value + bind:input="x = $event.detail.value"
  // 因此这里用 input 事件，并携带 detail.value
  emits: ['input'],
  setup(props, ctx) {
    const inner = ref(props.value ?? 0)

    watch(() => props.value, (val) => {
      inner.value = val ?? 0
    })

    const value = computed({
      get: () => inner.value,
      set: (v: number) => {
        inner.value = v
        ctx.emit('input', { value: v })
      },
    })

    const inc = () => value.value < (props.max ?? Infinity) && value.value++
    const dec = () => value.value > (props.min ?? -Infinity) && value.value--

    return { value, inc, dec }
  },
})
</script>

<template>
  <view class="stepper">
    <button @tap="dec">
      -
    </button>
    <text>{{ value }}</text>
    <button @tap="inc">
      +
    </button>
  </view>
</template>
```

使用：

```vue
<Stepper v-model="state.amount" :min="1" :max="5" />
```

## v-model 支持范围与限制

`weapp-vite` 的 Vue 模板编译会把 `v-model="x"` 直接编译成**小程序的“赋值表达式事件”**（例如 `bind:input="x = $event.detail.value"`），因此它有一些明确限制：

- **表达式必须可赋值**：只建议写 `x` / `x.y` / `x[i]` 这类“左值”。不要写 `a + b`、函数调用、可选链（`a?.b`）等。
- **不支持 v-model 参数/修饰符**：`v-model:title`、`v-model.trim/.number/.lazy` 目前不会按 Vue 语义生效（会当作普通 v-model 处理，可能导致行为不符合预期）。
- **仅对部分表单元素做了专门映射**（见下表）。其他标签会退化为 `value + bind:input` 并给出编译警告。

当前内置映射（实现位于 `packages/weapp-vite/src/plugins/vue/compiler/template.ts`）：

| 标签                    | 绑定属性  | 事件          | 赋值来源                                    |
| ----------------------- | --------- | ------------- | ------------------------------------------- |
| `input`（默认/text）    | `value`   | `bind:input`  | `$event.detail.value`                       |
| `input type="checkbox"` | `checked` | `bind:change` | `$event.detail.value`（实现为 best-effort） |
| `input type="radio"`    | `checked` | `bind:change` | `$event.detail.value`                       |
| `textarea`              | `value`   | `bind:input`  | `$event.detail.value`                       |
| `select`                | `value`   | `bind:change` | `$event.detail.value`                       |
| `switch` / `checkbox`   | `checked` | `bind:change` | `$event.detail.value`                       |
| `slider` / `picker`     | `value`   | `bind:change` | `$event.detail.value`                       |

> 建议：复杂/非标准表单（如 `radio-group` / `checkbox-group`）或自定义组件，优先使用显式 `:value` + `@input/@change`，或者用 `wevu` 的 `ctx.bindModel()` 自己定义 `event/valueProp/parser`。

## 配置块模式对比

| 写法                    | 作用                     | 适合场景           |
| ----------------------- | ------------------------ | ------------------ |
| `<config lang="jsonc">` | JSON/JSONC + Schema 提示 | 静态配置、可写注释 |
| `<config lang="ts">`    | TS + 类型检查            | 动态/异步配置      |
| `<config>`              | 默认 TS 严格模式         | 推荐默认写法       |

示例（动态配置）：

```vue
<config lang="ts">
import type { Page } from '@weapp-core/schematics'

export default async (): Promise<Page> => {
  const remote = await fetch('/api/config').then(r => r.json())
  return {
    navigationBarTitleText: remote.title ?? '默认标题',
  }
}
</config>
```

## 最佳实践与限制

- 使用小程序组件/事件名：模板中的 `<view>`、`<button>`、`@tap` 等会在构建时转为原生写法。
- 避免 DOM 专属 API（`window/document`）；需用小程序 API（如 `wx.request`）。
- 样式选择器遵循小程序规范；`scoped` 样式会编译为符合小程序前缀的选择器。
- 若使用 `<slot>`，保持与小程序组件 slot 语义一致。
- 需要小程序特性（下拉刷新、分享、页面滚动），请通过 `defineComponent` 的 `features` 开启。

更多实践可搭配仓库中的示例应用 `apps/wevu-*`（如 [wevu-comprehensive-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-comprehensive-demo)、[wevu-runtime-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-runtime-demo)、[wevu-vue-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-vue-demo)）。
