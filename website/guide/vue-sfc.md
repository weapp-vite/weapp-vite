---
title: Vue SFC 开发指南
---

# 在 weapp-vite 中使用 Vue SFC

weapp-vite 内置了 Vue SFC 编译链路，配合 `wevu` 运行时即可用 Vue 风格开发小程序页面/组件，同时保持小程序能力（页面特性、分享、性能优化）。

> 适用版本：Vue SFC 仅在 `weapp-vite@6.x` 及以上可用，请先升级到 6 大版本。

## 建议阅读顺序（目录）

- 先把“编译期/运行期”分清：`[Vue SFC = 编译期（weapp-vite）+ 运行期（wevu）](#vue-sfc--编译期weapp-vite--运行期wevu)`
- 再看最常用写法：`[基础范式](#基础范式)`、`[配置块模式对比](#配置块模式对比)`、`[Script Setup JSON 宏](#script-setup-json-macros)`
- 高频踩坑集中区：`[usingComponents 规则](#usingcomponents为什么脚本里不要-import)`、`[v-model 限制](#v-model-支持范围与限制)`、`[页面事件与生命周期](#页面事件与生命周期怎么触发)`
- 出问题先看：`[调试与排错](#调试与排错)`

## 安装准备

- 需要安装 wevu（任意包管理器均可 `add/install wevu`）。
- 官方模板已默认带上，手动集成时请先装依赖再继续。

## Vue SFC = 编译期（weapp-vite）+ 运行期（wevu）

在小程序里写 Vue SFC，建议把心智模型拆成两段：

- **编译期（weapp-vite）**：负责把 `.vue` 拆解/编译为小程序产物（WXML/WXSS/JS/JSON），并做模板语法（如 `v-if/v-for/v-model`）到 WXML 的转换。
- **运行期（wevu）**：负责响应式、生命周期 hooks、快照 diff 与最小化 `setData`，让你用 Vue 3 风格的 Composition API 写业务逻辑。

因此：

- “模板能不能写”看编译器规则（本页主要讲这个）。
- “状态为什么不更新 / hooks 为什么不触发”通常是运行时使用方式问题（请对照 `/wevu/runtime` 与 `/wevu/compatibility`）。

## 基础范式

- `wevu` 提供运行时：`defineComponent`（页面/组件统一使用）、`ref/reactive/computed/watch`、生命周期等。
- 推荐使用 Script Setup JSON 宏（build-time）注入小程序 App/Page/Component 配置；也可在 SFC `<json>` 块中编写静态配置。配合 `weapp-vite/volar` 获得智能提示。
- 模板语法与 Vue 3 基本一致（事件、v-if/v-for/class/style 绑定），构建时转为小程序原生 WXML。
- 样式使用 `<style lang="scss|less|css">`，构建后输出 `wxss`。
- 组件引入沿用小程序约定：在 `<json>` 的 `usingComponents` 中声明，脚本里不要用 ESModule `import` 引入组件。
- props 推荐：wevu 会把 Vue 风格的 `props` 规范化为小程序 `properties`，原生 `properties` 亦兼容。

## 页面与组件：如何区分

在微信小程序里，页面与组件都是“用 `Component()` 注册”的，但它们的 JSON 字段与生命周期事件并不一样。

- **页面**：通常位于 `src/pages/**/index.vue`，最终会出现在 `app.json` 的 `pages` 列表中（来源依赖你的路由/扫描策略）。
  - 页面配置用 `definePageJson()` 或 `<json>` 写（最终生成 `page.json`）。
  - 页面 hooks（滚动/分享/触底/下拉刷新等）只对页面生效。
- **组件**：通常位于 `src/components/**/index.vue`，通过页面/组件 JSON 的 `usingComponents` 使用。
  - 组件配置用 `defineComponentJson()` 或 `<json>` 写（最终生成 `component.json`），并确保 `component: true`。

组件最小示例（只展示关键字段）：

```vue
<!-- components/MyCard/index.vue -->
<script setup lang="ts">
defineComponentJson(() => ({
  component: true,
  options: { virtualHost: true },
}))
</script>

<template>
  <view class="card">
    <slot />
  </view>
</template>
```

## .vue 编写注意事项（示例前必看）

- `<script lang="ts">`：页面/组件均使用 `export default defineComponent({ setup() {...} })` 注册；组件推荐写 `props`（wevu 会转为小程序 `properties`），并在 `setup()` 里返回/暴露模板需要的数据与方法。
- `<script setup lang="ts">`：组合式语法糖，顶层定义的 ref/computed/函数会自动暴露到模板；如需声明 props/emits 使用 `defineProps/defineEmits`。
- 运行时 API 请从 `wevu` 导入（`ref/reactive/computed/watch`、生命周期钩子等），确保挂载到小程序生命周期与 `setData` diff。
- `usingComponents` 可写在 `<json>` 块，也可通过 Script Setup JSON 宏注入；脚本侧不要通过 `import` 注册小程序组件（见下文）。
- 避免直接使用 `window/document` 等浏览器专属能力，需改用微信小程序 API；模板事件使用小程序事件名（`@tap` 等）。

## usingComponents：为什么脚本里不要 import

小程序组件的注册是 **JSON 声明式** 的：只认 `usingComponents`。因此在 SFC 里推荐：

- 在 `<json>` 或 `definePageJson/defineComponentJson` 里声明 `usingComponents`
- 模板里直接写组件标签（例如 `<my-card />`）

页面示例：

```vue
<script setup lang="ts">
definePageJson(() => ({
  usingComponents: {
    'my-card': '/components/MyCard/index',
  },
}))
</script>

<template>
  <my-card />
  <!-- 也可以传 slot -->
  <my-card>
    <text>hello</text>
  </my-card>
</template>
```

:::warning 常见误区
不要把小程序组件当成 Web Vue 组件来做“ESM import + components 注册”。即使你在脚本里写了 import，最终是否能工作也取决于产物如何生成 `usingComponents`。
:::

## 页面示例：计数 + 分享 + 页面滚动

```vue
<!-- pages/counter/index.vue -->
<script setup lang="ts">
import { computed, onPageScroll, onShareAppMessage, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '计数器',
}))

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

function inc() {
  count.value += 1
}
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
```

> 提示：tsconfig.app.json 已预置 `"vueCompilerOptions.plugins": ["weapp-vite/volar"]`，配合 Volar 扩展即可获得 `<json>` 与模板提示。

> 说明：小程序部分页面事件是“按需派发”（分享/滚动等），weapp-vite 会在编译阶段根据你是否调用 `onPageScroll/onShareAppMessage/...` 自动补齐 `features.enableOnXxx = true`；如需手动控制，仍可在 `defineComponent({ features: ... })` 中显式覆盖。

## 页面事件与生命周期：怎么触发

在小程序里，很多页面事件属于“按需派发”：

- 只有你定义了 `onPageScroll/onReachBottom/onPullDownRefresh/...` 这些页面方法，事件才会从渲染层派发到逻辑层。
- `wevu` 的 `onPageScroll/onShareAppMessage/...` hooks，本质也是在注册对应页面方法。

你通常不需要手写 `features.enableOnXxx`：

- **使用 weapp-vite 构建**：当编译器检测到你调用了对应 hooks，会在编译阶段自动补齐 `features.enableOnXxx = true`（见上面的说明）。
- **不使用 weapp-vite（或极端场景）**：才需要在 `defineComponent({ features: ... })` 里手动开启。

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

| 写法                  | 作用                | 适合场景                 |
| --------------------- | ------------------- | ------------------------ |
| `<json>`              | JSONC + Schema 提示 | 静态配置（默认可写注释） |
| `<json lang="jsonc">` | JSONC + Schema 提示 | 静态配置（显式标注）     |
| `<json lang="ts/js">` | TS/JS + 类型检查    | 动态/异步配置            |
| Script Setup 宏       | build-time 注入配置 | 覆盖/拼装页面与组件配置  |

示例（动态配置）：

```vue
<script setup lang="ts">
definePageJson(async () => ({
  navigationBarTitleText: process.env.APP_TITLE ?? '默认标题',
}))
</script>
```

## Script Setup JSON 宏（build-time） {#script-setup-json-macros}

`weapp-vite` 支持在 Vue SFC 的 `<script setup>` 中使用以下 **JSON 宏**，并在构建时把返回结果合并进最终的 `page.json` / `component.json`：

- `defineAppJson`
- `definePageJson`
- `defineComponentJson`

特点与限制：

- 必须是 `<script setup>` 的**顶层语句**，且**只能传 1 个参数**。
- 同一个 SFC 内只能使用一种宏（例如只能用 `definePageJson`），但可以调用多次；多次返回会 **deep merge**（后者覆盖前者）。
- 支持 `object` / `() => object` / `async () => object`（也支持返回 `Promise`）。
- 宏只在 **构建期（Node.js）** 执行：请保持幂等，避免依赖小程序运行时 API；推荐只做本地 import、常量拼装与轻量计算。
- 合并优先级最高：会覆盖 `<json>` 块以及自动 `usingComponents` 的结果。

> TypeScript 提示：确保项目的 `vite-env.d.ts` 包含 `/// <reference types="weapp-vite/client" />`（脚手架默认已配置），这样 IDE 才能识别这些全局宏。

组件示例：

```vue
<script setup lang="ts">
defineComponentJson(() => ({
  styleIsolation: 'isolated',
  options: { virtualHost: true },
  externalClasses: ['macro-card-class'],
}))
</script>
```

页面示例：

```vue
<script setup lang="ts">
import { macroDemoNavBg, macroDemoNavTitle } from './macro.config'

definePageJson(() => ({
  navigationBarTitleText: macroDemoNavTitle,
  navigationBarBackgroundColor: macroDemoNavBg,
  enablePullDownRefresh: true,
}))
</script>
```

## 最佳实践与限制

- 使用小程序组件/事件名：模板中的 `<view>`、`<button>`、`@tap` 等会在构建时转为原生写法。
- 避免 DOM 专属 API（`window/document`）；需用小程序 API（如 `wx.request`）。
- 样式选择器遵循小程序规范；`scoped` 样式会编译为符合小程序前缀的选择器。
- 若使用 `<slot>`，保持与小程序组件 slot 语义一致。
- 需要分享/朋友圈/收藏能力时，请按微信官方实现页面回调（`onShareAppMessage/onShareTimeline/onAddToFavorites`），并在需要时调用 `wx.showShareMenu()` 配置菜单项。

## 组件示例：Props + Emits + v-model（Script Setup + 宏）

这个示例展示一个自定义组件如何配合 `v-model` 工作。对于自定义组件，`weapp-vite` 会把 `v-model="x"` 按默认策略编译为 `value="{{x}}"` + `bind:input="x = $event.detail.value"`，因此组件侧需要：

- 接收 `value`（props）
- 触发 `input` 事件，并在 `detail.value` 中带回新值

```vue
<!-- components/stepper/index.vue -->
<script setup lang="ts">
import { computed } from 'wevu'

const props = withDefaults(defineProps<{
  value?: number
  min?: number
  max?: number
}>(), {
  value: 0,
  min: 0,
  max: 10,
})

const emit = defineEmits<{
  (e: 'input', detail: { value: number }): void
}>()

defineComponentJson(() => ({
  component: true,
}))

const value = computed(() => props.value ?? 0)

function setValue(next: number) {
  emit('input', { value: next })
}

function inc() {
  if (value.value >= props.max) {
    return
  }
  setValue(value.value + 1)
}

function dec() {
  if (value.value <= props.min) {
    return
  }
  setValue(value.value - 1)
}
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

使用（页面侧同样推荐用宏注入 `usingComponents`）：

```vue
<!-- pages/demo/index.vue -->
<script setup lang="ts">
import { reactive } from 'wevu'

definePageJson(() => ({
  usingComponents: {
    stepper: '/components/stepper/index',
  },
}))

const state = reactive({ amount: 1 })
</script>

<template>
  <stepper v-model="state.amount" :min="1" :max="5" />
</template>
```

更多实践可搭配仓库中的示例应用 `apps/wevu-*`（如 [wevu-comprehensive-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-comprehensive-demo)、[wevu-runtime-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-runtime-demo)、[wevu-vue-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-vue-demo)）。

## 调试与排错

### 1) 组件不渲染

优先按这个顺序检查：

- `usingComponents` 是否声明、路径是否正确（注意分包路径与大小写）。
- `component.json` 是否包含 `component: true`（组件必须是组件）。
- 开发者工具控制台是否提示 “usingComponents not found / component path not found / wxml parse error”。

### 2) 状态不更新

- 确认响应式 API 来自 `wevu`（不是 `vue`）。
- 确认你更新的是响应式值（例如 `ref.value`）。
- 确认模板确实依赖了该状态（否则更新不会反映到 UI）。

### 3) hooks 不触发（滚动/分享/触底等）

- hooks 必须在 `setup()` **同步阶段**注册（`await` 后注册会报错或失效）。
- 分享/朋友圈/收藏等能力是否满足微信官方触发条件（菜单项、`open-type="share"`、`wx.showShareMenu()` 等）。

### 4) v-model 行为不符合 Vue 预期

回到本页的 `v-model` 限制：它是小程序“赋值表达式事件”，不是 Vue 的完整 v-model 语义（参数/修饰符等）。

更强的双向绑定方案请参考：`/wevu/runtime` 的 `bindModel` 部分。
