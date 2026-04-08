---
title: Vue SFC：配置与宏
description: 小程序组件的注册是 **JSON 声明式** 的：只认 usingComponents。因此在 SFC 里推荐：
keywords:
  - Wevu
  - Vue SFC
  - 配置
  - vue
  - sfc
  - config
  - SFC：配置与宏
  - 小程序组件的注册是
---

# Vue SFC：配置与宏

## usingComponents：为什么脚本里不要 import

小程序组件的注册是 **JSON 声明式** 的：只认 `usingComponents`。因此在 SFC 里推荐：

- 优先在 `defineAppJson/definePageJson/defineComponentJson` 里声明 `usingComponents`
- App/Page/Component SFC 能用对应 JSON 宏就不要再写 `<json>`
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

> 提示：`tsconfig.app.json` 已预置 `"vueCompilerOptions.plugins": ["weapp-vite/volar"]`，配合 Volar 扩展即可获得 JSON 宏与模板提示。

:::warning 必须设置 vueCompilerOptions.lib
若使用 Wevu 的 `<script setup>` 宏（`defineProps/withDefaults/defineEmits` 等），请务必在同一处设置 `"vueCompilerOptions.lib": "wevu"`，否则宏的类型提示会退化为 `any`。
:::

## 配置块模式对比

| 写法                  | 作用                | 适合场景                         |
| --------------------- | ------------------- | -------------------------------- |
| Script Setup 宏       | build-time 注入配置 | 默认方案（页面/组件/App 均推荐） |
| `<json>`              | JSONC + Schema 提示 | 兼容旧代码的静态配置             |
| `<json lang="jsonc">` | JSONC + Schema 提示 | 兼容旧代码的静态配置（显式标注） |
| `<json lang="ts/js">` | TS/JS + 类型检查    | 历史项目迁移期的动态/异步配置    |

```mermaid
flowchart TB
  A[最终 JSON（page.json / component.json / app.json）] <-- 合并/覆盖 --- B[配置来源]
  B --> C[<json> 自定义块]
  B --> D[auto usingComponents<br/>（基于 <template> 引用分析）]
  B --> E[Script Setup JSON 宏<br/>definePageJson / defineComponentJson / defineAppJson]
  E -->|优先级最高| A
  C --> A
  D --> A
```

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

建议：

- App/Page/Component SFC 默认使用对应宏：
  - App 用 `defineAppJson`
  - Page 用 `definePageJson`
  - Component 用 `defineComponentJson`
- `<json>` 作为兼容模式保留，不建议在新增 SFC 里使用。

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

这里要注意字段分层：

- `virtualHost`、`multipleSlots`、`styleIsolation` 这类原生 `ComponentOptions` 字段，放在 `options`
- `externalClasses`、`behaviors`、`relations` 这类组件顶层字段，不要塞进 `options`

错误示例：

```vue
<script setup lang="ts">
defineOptions({
  options: {
    externalClasses: ['class'],
  },
})
</script>
```

正确示例：

```vue
<script setup lang="ts">
defineOptions({
  externalClasses: ['class'],
  options: {
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
})
</script>
```

如果你想把组件宿主节点虚拟化，这就是最直接的写法。若项目里大多数组件都需要 `virtualHost: true`，更推荐在 [/config/wevu](/config/wevu) 里统一配置：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      defaults: {
        component: {
          options: {
            virtualHost: true,
          },
        },
      },
    },
  },
})
```

补充说明：

- 这个全局默认值只会作用于组件，不会把页面默认改成 `virtualHost: true`
- 页面若确实需要开启，请在页面内显式声明 `options.virtualHost`
- 局部组件自己写的 `options.virtualHost` 优先级高于全局默认值

## `virtualHost` 与样式透传边界

`virtualHost: true` 经常和 `styleIsolation: 'apply-shared'` 一起使用，但这两个配置解决的问题并不一样：

- `virtualHost: true`：隐藏组件宿主节点
- `styleIsolation: 'apply-shared'`：允许页面样式影响组件内部

它们**不会**自动提供 Vue Web 里的“根节点 `class/style` fallthrough”。

也就是说，下面这种写法并不意味着组件内部根节点一定会变红：

```vue
<MyCard class="text-red-500" />
```

如果组件没有显式把外部类名或样式绑定到内部根节点，那么：

- 组件标签上的 `class` 仍然只是挂在组件标签上
- `virtualHost: true` 时宿主节点不可见，这个 `class` 没有可见挂载点
- `styleIsolation: 'apply-shared'` 也不会帮你自动把这个 `class` 合并进内部根节点

### 推荐写法

如果你希望组件支持外部样式，推荐显式设计 API，而不是依赖隐式透传。

写法 1：外部类名

```vue
<script setup lang="ts">
defineOptions({
  externalClasses: ['custom-class'],
})
</script>

<template>
  <view class="card custom-class">
    <slot />
  </view>
</template>
```

父组件：

```vue
<MyCard custom-class="text-red-500 border border-red-500" />
```

写法 2：显式样式 prop

```vue
<script setup lang="ts">
const props = defineProps<{
  rootStyle?: string
}>()
</script>

<template>
  <view class="card" :style="props.rootStyle">
    <slot />
  </view>
</template>
```

父组件：

```vue
<MyCard root-style="color:#2563eb;background:#dbeafe;" />
```

> [!TIP]
> 如果你确实想沿用组件标签上的 `class`，也可以声明 `externalClasses: ['class']`，但仍然要在内部根节点显式写出 `class` 占位。

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
