---
title: Vue SFC 开发指南
---

# 在 weapp-vite 中使用 Vue SFC

weapp-vite 内置了 Vue SFC 编译链路，配合 `wevu` 运行时即可用 Vue 风格开发小程序页面/组件，同时保持小程序能力（页面特性、分享、性能优化）。

## 安装准备

- 需要安装 wevu（任意包管理器均可 `add/install wevu`）。
- 官方模板已默认带上，手动集成时请先装依赖再继续。

## 基础范式

- `wevu` 提供运行时：`definePage`、`defineComponent`、`ref/reactive/computed/watch`、生命周期等。
- SFC `<config>` 块承载小程序 App/Page/Component 配置，配合 `weapp-vite/volar` 获得智能提示。
- 模板语法与 Vue 3 基本一致（事件、v-if/v-for/class/style 绑定），构建时转为小程序原生 WXML。
- 样式使用 `<style lang="scss|less|css">`，构建后输出 `wxss`。
- 组件引入沿用小程序约定：在 `<config>` 的 `usingComponents` 中声明，脚本里不要用 ESModule `import` 引入组件。

## 页面示例：计数 + 分享 + 页面滚动

```vue
<!-- pages/counter/index.vue -->
<script lang="ts">
import { computed, definePage, onPageScroll, onShareAppMessage, ref } from 'wevu'

export default definePage(
  {
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
  },
  {
    listenPageScroll: true,
    enableShareAppMessage: true,
  },
)
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
import { computed, defineComponent, ref } from 'wevu'

export default defineComponent({
  properties: {
    modelValue: { type: Number, value: 0 },
    min: { type: Number, value: 0 },
    max: { type: Number, value: 10 },
  },
  setup(ctx) {
    const inner = ref(ctx.props.modelValue ?? 0)

    const value = computed({
      get: () => inner.value,
      set: (v: number) => {
        inner.value = v
        ctx.emit?.('update:modelValue', v)
      },
    })

    const inc = () => value.value < (ctx.props.max ?? Infinity) && value.value++
    const dec = () => value.value > (ctx.props.min ?? -Infinity) && value.value--

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
<Stepper v-model="state.amount" :min="1" :max="5" @update:modelValue="val => state.amount = val" />
```

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
- 需要小程序特性（下拉刷新、分享、页面滚动），请通过 `definePage` 第二参数开启。

更多实践可搭配仓库中的示例应用 `apps/wevu-*`（如 [wevu-comprehensive-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-comprehensive-demo)、[wevu-runtime-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-runtime-demo)、[wevu-vue-demo](https://github.com/weapp-labs/weapp-vite/tree/main/apps/wevu-vue-demo)）。
