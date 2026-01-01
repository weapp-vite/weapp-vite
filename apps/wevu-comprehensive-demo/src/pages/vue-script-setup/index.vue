<script setup lang="ts">
import { computed, getCurrentInstance, onShow, ref } from 'wevu'

type Level = 'info' | 'warning' | 'danger'

defineOptions({
  name: 'VueScriptSetupDemo',
  inheritAttrs: false,
})

const basicCount = ref(0)
const basicMessage = ref('Script Setup 顶层变量自动暴露')
const basicItems = ref(['项目1', '项目2', '项目3'])

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
const modelText = ref('hello')

const instanceKeysText = (() => {
  const instance = getCurrentInstance() as any
  return instance ? Object.keys(instance).slice(0, 8).join(', ') : 'n/a'
})()

function increment() {
  counter.value += 1
  emit('update', counter.value)
  emit('log', `count=${counter.value}`)
}

function incrementBasic() {
  basicCount.value += 1
}

function updateBasicMessage() {
  basicMessage.value = `更新于 ${new Date().toLocaleTimeString()}`
}

function addBasicItem() {
  basicItems.value.push(`项目 ${basicItems.value.length + 1}`)
}

function onModelUpdate(event: any) {
  modelText.value = event?.detail ?? ''
}

onShow(() => {
  console.log('[vue-script-setup] onShow')
})

defineExpose({
  counter,
  doubled,
  increment,
  instanceKeysText,
  modelText,
})
</script>

<template>
  <view class="container">
    <view class="page-title">
      Script Setup
    </view>

    <view class="section">
      <view class="section-title">
        语法糖：顶层变量 / 生命周期
      </view>
      <view class="demo-item">
        <text class="label">
          count: {{ basicCount }}
        </text>
        <button class="btn btn-primary" @click="incrementBasic">
          +1
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          {{ basicMessage }}
        </text>
        <button class="btn btn-success" @click="updateBasicMessage">
          更新
        </button>
      </view>
      <view class="card">
        <view v-for="(item, index) in basicItems" :key="index" class="row">
          <text>{{ item }}</text>
        </view>
        <button size="mini" class="btn btn-info" @click="addBasicItem">
          添加项目
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        defineProps / withDefaults / defineOptions
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

    <view class="section">
      <view class="section-title">
        defineModel / defineSlots / useAttrs / useSlots
      </view>
      <view class="card">
        <text class="muted">
          parent modelText: {{ modelText }}
        </text>
        <define-model-child
          :model-value="modelText"
          @update:modelValue="onModelUpdate($event)"
        >
          <text class="muted">
            slot content from parent
          </text>
        </define-model-child>
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

.row {
  padding: 10rpx 0;
  border-bottom: 1rpx solid #e2e8f0;
  font-size: 26rpx;
  color: #0f172a;
}

.row:last-of-type {
  border-bottom: none;
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
  "navigationBarTextStyle": "white",
  "usingComponents": {
    "define-model-child": "/components/vue-define-model-child/index"
  }
}
</json>
