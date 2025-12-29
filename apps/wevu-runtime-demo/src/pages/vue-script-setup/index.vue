<script setup lang="ts">
import { useAttrs, useSlots } from 'vue'
import { computed, ref } from 'wevu'

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

const attrs = useAttrs()
const slots = useSlots()

function increment() {
  counter.value += 1
  emit('update', counter.value)
  emit('log', `count=${counter.value}`)
}

defineExpose({
  counter,
  doubled,
  increment,
  attrs,
  slots,
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
          attrs: {{ JSON.stringify(attrs) }}
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
        <button class="btn btn-primary" @tap="increment">
          +1（emit）
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        defineExpose / useSlots
      </view>
      <view class="card">
        <text class="muted">
          slots keys: {{ Object.keys(slots).join(', ') || 'none' }}
        </text>
        <slot />
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
}

.section {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.demo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 0;
}

.label {
  font-size: 24rpx;
  color: #475569;
}

.btn {
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.btn-primary {
  background: #111827;
  color: #ffffff;
}

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

<config lang="json">
{
  "navigationBarTitleText": "Script Setup",
  "navigationBarBackgroundColor": "#111827",
  "navigationBarTextStyle": "white"
}
</config>
