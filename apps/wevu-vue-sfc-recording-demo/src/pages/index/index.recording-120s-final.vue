<script setup lang="ts">
import { computed, onShow, ref, watch } from 'wevu'

definePageJson({
  navigationBarTitleText: 'wevu Vue SFC 120 秒录屏',
})

interface DemoFeature {
  name: string
  done: boolean
  level: 'core' | 'plus'
}

const projectName = ref('weapp-vite + wevu')
const clicks = ref(0)
const keyword = ref('')
const features = ref<DemoFeature[]>([
  { name: 'Vue SFC 编译', done: true, level: 'core' },
  { name: 'definePageJson 宏', done: true, level: 'core' },
  { name: 'wevu 组合式 API', done: false, level: 'plus' },
  { name: '智能提示录屏演示', done: false, level: 'plus' },
])

const finishedCount = computed(() => features.value.filter(item => item.done).length)
const progressText = computed(() => `${finishedCount.value}/${features.value.length}`)

const filteredFeatures = computed(() => {
  if (!keyword.value.trim())
    return features.value

  return features.value.filter(item => item.name.includes(keyword.value.trim()))
})

function increase() {
  clicks.value += 1
}

function toggle(index: number) {
  const target = filteredFeatures.value[index]
  if (!target)
    return

  target.done = !target.done
}

function reset() {
  clicks.value = 0
  keyword.value = ''
  features.value = features.value.map(item => ({
    ...item,
    done: item.name.includes('编译') || item.name.includes('宏'),
  }))
}

onShow(() => {
  console.log('[recording-demo-120s] page show')
})

watch(clicks, (newValue, oldValue) => {
  console.log(`[recording-demo-120s] clicks: ${oldValue} -> ${newValue}`)
})
</script>

<template>
  <view class="page">
    <text class="title">{{ projectName }}</text>
    <text class="subtitle">目标：120 秒展示真实编码流（含一次修正）。</text>

    <view class="card">
      <view class="row between">
        <text class="label">点击计数</text>
        <text class="value">{{ clicks }}</text>
      </view>

      <view class="row between">
        <text class="label">完成进度</text>
        <text class="value">{{ progressText }}</text>
      </view>

      <view class="row between">
        <text class="label">筛选关键词</text>
        <input
          class="keyword-input"
          :value="keyword"
          placeholder="输入关键词"
          @input="keyword = $event.detail.value"
        />
      </view>

      <view class="action-row">
        <button class="btn" type="primary" @tap="increase">+1</button>
        <button class="btn" @tap="reset">重置</button>
      </view>
    </view>

    <view class="feature-list">
      <view
        v-for="(item, index) in filteredFeatures"
        :key="item.name"
        class="feature-item"
        @tap="toggle(index)"
      >
        <text class="feature-name">{{ item.name }}</text>
        <text class="feature-tag">{{ item.level === 'core' ? '核心' : '扩展' }}</text>
        <text class="feature-state" :class="item.done ? 'done' : 'todo'">
          {{ item.done ? '已完成' : '待完成' }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 36rpx;
  background: linear-gradient(180deg, #f4f8ff 0%, #edf4ff 100%);
  box-sizing: border-box;
}

.title {
  display: block;
  font-size: 42rpx;
  font-weight: 600;
  color: #0f2b52;
}

.subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  color: #45658b;
}

.card {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.row {
  display: flex;
  align-items: center;
}

.between {
  justify-content: space-between;
}

.row + .row {
  margin-top: 16rpx;
}

.label {
  font-size: 28rpx;
  color: #5c6f89;
}

.value {
  font-size: 30rpx;
  font-weight: 600;
  color: #14315b;
}

.keyword-input {
  width: 300rpx;
  height: 56rpx;
  padding: 0 16rpx;
  border: 1rpx solid #dbe6f5;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.action-row {
  margin-top: 24rpx;
  display: flex;
  gap: 16rpx;
}

.btn {
  flex: 1;
}

.feature-list {
  margin-top: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
  overflow: hidden;
}

.feature-item {
  padding: 22rpx 24rpx;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  column-gap: 18rpx;
}

.feature-item + .feature-item {
  border-top: 1rpx solid #e8eef7;
}

.feature-name {
  font-size: 28rpx;
  color: #1d3a64;
}

.feature-tag {
  font-size: 22rpx;
  color: #1d5fb8;
  background: #e8f1ff;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}

.feature-state {
  font-size: 24rpx;
}

.done {
  color: #13886f;
}

.todo {
  color: #cc7a1f;
}
</style>
