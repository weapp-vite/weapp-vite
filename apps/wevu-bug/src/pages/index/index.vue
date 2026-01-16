<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'wevu'

import HelloWorld from '@/components/HelloWorld/index.vue'

definePageJson({
  navigationBarTitleText: 'wevu-bug',
})

const count = ref(0)
const message = ref('Hello WeVU!')
const todos = ref([
  '用 Vue SFC 写页面/组件',
  '用 wevu API（ref/computed/watch）写逻辑',
  '用 v-for / v-if / @tap / v-model 写模板',
])

const doubled = computed(() => count.value * 2)

const headerRef = useTemplateRef('headerRef')
const viewRef = useTemplateRef('viewRef')
const textRef = useTemplateRef('textRef')

onMounted(() => {
  console.log(headerRef.value, viewRef.value, textRef.value)
  console.log(headerRef.value?.headerKey)
})

const headerRect = ref('未就绪')
const viewRect = ref('未就绪')
const textRect = ref('未就绪')

function increment() {
  count.value += 1
}

function reset() {
  count.value = 0
}

watch(count, (newValue, oldValue) => {
  console.log(`[wevu] count changed: ${oldValue} -> ${newValue}`)
})

function updateRect(target: any, setter: (value: string) => void) {
  if (!target) {
    setter('未就绪')
    return
  }
  target.boundingClientRect((rect: any) => {
    if (!rect) {
      setter('null')
      return
    }
    const width = Math.round(rect.width ?? 0)
    const height = Math.round(rect.height ?? 0)
    setter(`${width}x${height}`)
  })
}

watch(headerRef, value => updateRect(value, nextValue => (headerRect.value = nextValue)), { immediate: true })
watch(viewRef, value => updateRect(value, nextValue => (viewRect.value = nextValue)), { immediate: true })
watch(textRef, value => updateRect(value, nextValue => (textRect.value = nextValue)), { immediate: true })
</script>

<template>
  <view class="page">
    <HelloWorld ref="headerRef" :title="message" :subtitle="`count=${count}, doubled=${doubled}`" />

    <view class="card">
      <view class="row">
        <text class="label">
          当前计数：{{ count }}
        </text>
        <text class="label">
          双倍：{{ doubled }}
        </text>
      </view>

      <view class="row actions">
        <button class="btn primary" @tap="increment">
          +1
        </button>
        <button class="btn danger" @tap="reset">
          重置
        </button>
      </view>

      <view class="row">
        <text class="label">
          文本双向绑定：
        </text>
      </view>
      <input v-model="message" class="input" placeholder="输入标题…">

      <view class="row">
        <text class="label">
          Checklist
        </text>
      </view>
      <view class="todo">
        <view v-for="(todo, index) in todos" :key="index" class="todo-item">
          <text>• {{ todo }}</text>
        </view>
      </view>
    </view>

    <view class="card ref-card">
      <view class="row">
        <text class="label">
          useTemplateRef 示例
        </text>
      </view>
      <view class="ref-demo">
        <view ref="viewRef" class="ref-box">
          普通 view
        </view>
        <text ref="textRef" class="ref-text">
          普通 text
        </text>
        <view class="ref-status">
          <text class="status-line">
            组件 ref（HelloWorld）：{{ headerRect }}
          </text>
          <text class="status-line">
            view ref：{{ viewRect }}
          </text>
          <text class="status-line">
            text ref：{{ textRect }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  padding: 48rpx 32rpx 64rpx;
}

.card {
  padding: 32rpx;
  margin-top: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 32rpx rgb(44 44 84 / 10%);
}

.row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.label {
  font-size: 30rpx;
  color: #1c1c3c;
}

.actions {
  margin: 24rpx 0;
}

.btn {
  flex: 1;
  line-height: 96rpx;
  color: #fff;
  border-radius: 16rpx;
}

.btn.primary {
  background: #4c6ef5;
}

.btn.danger {
  background: #f03e3e;
}

.input {
  box-sizing: border-box;
  height: 88rpx;
  padding: 0 24rpx;
  margin: 0 0 24rpx;
  background: #fff;
  border: 2rpx solid #e9ecef;
  border-radius: 16rpx;
}

.todo-item {
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #4f4f7a;
}

.ref-card {
  margin-top: 24rpx;
}

.ref-demo {
  display: grid;
  gap: 16rpx;
}

.ref-box {
  padding: 16rpx;
  font-size: 26rpx;
  color: #343a40;
  background: #f1f3f5;
  border-radius: 12rpx;
}

.ref-text {
  font-size: 26rpx;
  color: #495057;
}

.ref-status {
  padding: 16rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
}

.status-line {
  display: block;
  font-size: 24rpx;
  color: #495057;
}
</style>
