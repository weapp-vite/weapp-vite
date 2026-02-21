<script setup lang="ts">
import { computed, onShow, ref, watch } from 'wevu'

definePageJson({
  navigationBarTitleText: 'wevu Vue SFC 录屏 Demo',
})

interface DemoFeature {
  name: string
  done: boolean
}

const projectName = ref('weapp-vite + wevu')
const clicks = ref(0)
const features = ref<DemoFeature[]>([
  { name: 'Vue SFC 编译到小程序产物', done: true },
  { name: 'definePageJson 宏配置', done: true },
  { name: 'wevu 组合式 API', done: false },
  { name: 'VSCode 智能提示录屏', done: false },
])

const finishedCount = computed(() => features.value.filter(item => item.done).length)
const progressText = computed(() => `${finishedCount.value}/${features.value.length}`)

function increase() {
  clicks.value += 1
}

function toggle(index: number) {
  const target = features.value[index]
  if (!target)
    return

  target.done = !target.done
}

function reset() {
  clicks.value = 0
  features.value = features.value.map(item => ({
    ...item,
    done: item.name.includes('编译') || item.name.includes('宏配置'),
  }))
}

onShow(() => {
  console.log('[recording-demo] page show')
})

watch(clicks, (newValue, oldValue) => {
  console.log(`[recording-demo] clicks: ${oldValue} -> ${newValue}`)
})
</script>

<template>
  <view class="page">
    <text class="title">{{ projectName }}</text>
    <text class="subtitle">在录屏里展示：补全、选择提示、保存、预览同步刷新。</text>

    <view class="card">
      <view class="row between">
        <text class="label">点击计数</text>
        <text class="value">{{ clicks }}</text>
      </view>

      <view class="row between">
        <text class="label">完成进度</text>
        <text class="value">{{ progressText }}</text>
      </view>

      <view class="action-row">
        <button class="btn" type="primary" @tap="increase">+1</button>
        <button class="btn" @tap="reset">重置</button>
      </view>
    </view>

    <view class="feature-list">
      <view
        v-for="(item, index) in features"
        :key="item.name"
        class="feature-item"
        @tap="toggle(index)"
      >
        <text class="feature-name">{{ item.name }}</text>
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
  box-shadow: 0 14rpx 38rpx rgba(31, 122, 236, 0.09);
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feature-item + .feature-item {
  border-top: 1rpx solid #e8eef7;
}

.feature-name {
  font-size: 28rpx;
  color: #1d3a64;
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
