<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'wevu'

type Level = 'info' | 'warning' | 'danger'

defineOptions({
  name: 'VueScriptSetupDemo',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  title?: string
  initial?: number
  level?: Level
}>(), {
  title: 'Script Setup 宏与写法覆盖',
  initial: 1,
  level: 'info',
})

const emit = defineEmits<{
  (e: 'update', value: number): void
  (e: 'log', message: string): void
}>()

const counter = ref(props.initial)
const doubled = computed(() => counter.value * 2)

const instanceKeysText = (() => {
  const instance = getCurrentInstance() as any
  return instance ? Object.keys(instance).slice(0, 8).join(', ') : 'n/a'
})()

function increment() {
  counter.value += 1
  emit('update', counter.value)
  emit('log', `count=${counter.value}`)
}

defineExpose({
  counter,
  doubled,
  increment,
  instanceKeysText,
})
</script>

<template>
  <view class="container">
    <view class="page-title">
      Script Setup
    </view>

    <view class="section">
      <view class="section-title">
        defineProps / withDefaults
      </view>
      <view class="card">
        <text class="title">
          {{ props.title }}
        </text>
        <text class="muted">
          level={{ props.level }}, initial={{ props.initial }}
        </text>
        <text class="muted">
          instance keys: {{ instanceKeysText }}
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        defineEmits
      </view>
      <view class="demo-item">
        <text class="label">
          count: {{ counter }} / doubled: {{ doubled }}
        </text>
        <button class="btn btn-primary" @click="increment">
          +1（emit）
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        defineExpose
      </view>
      <view class="card">
        <text class="muted">
          expose: counter / doubled / increment
        </text>
        <slot />
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.card {
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.title {
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.muted {
  font-size: 22rpx;
  color: #64748b;
  line-height: 1.6;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Script Setup",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white"
}
</json>
