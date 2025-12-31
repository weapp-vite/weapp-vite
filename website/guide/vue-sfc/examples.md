---
title: Vue SFC：示例
---

# Vue SFC：示例

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

> 说明：小程序部分页面事件是“按需派发”（分享/滚动等），weapp-vite 会在编译阶段根据你是否调用 `onPageScroll/onShareAppMessage/...` 自动补齐 `features.enableOnXxx = true`；如需手动控制，仍可在 `defineComponent({ features: ... })` 中显式覆盖。

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
