<script setup lang="ts">
import { computed, ref } from 'vue'

interface BasicsProps {
  greetings?: string[]
  initialActive?: boolean
  baseFont?: number
}

const props = withDefaults(defineProps<BasicsProps>(), {
  greetings: () => ['你好 weapp-vite', 'Hello Vue', 'Hola from Mini Program'],
  initialActive: true,
  baseFont: 28,
})

const currentIndex = ref(0)
const greeting = computed(() => props.greetings[currentIndex.value])
const upperCaseGreeting = computed(() => greeting.value.toUpperCase())

const isActive = ref(props.initialActive)
const fontSize = ref(props.baseFont)
const spacing = ref(2)

function cycleGreeting() {
  currentIndex.value = (currentIndex.value + 1) % props.greetings.length
}

function toggleActive() {
  isActive.value = !isActive.value
  fontSize.value = isActive.value ? props.baseFont + 2 : props.baseFont - 2
  spacing.value = isActive.value ? 2 : 1
}
</script>

<template>
  <view class="card">
    <text class="card-title">
      基础响应式与绑定
    </text>
    <text class="hint">
      ref + computed + 事件 + 动态绑定
    </text>

    <view class="row">
      <text class="label">
        问候语
      </text>
      <text class="value">
        {{ greeting }}
      </text>
    </view>
    <view class="row">
      <text class="label">
        大写
      </text>
      <text class="value">
        {{ upperCaseGreeting }}
      </text>
    </view>

    <view class="buttons">
      <button size="mini" @click="cycleGreeting">
        切换文案
      </button>
      <button size="mini" @tap="toggleActive">
        切换状态
      </button>
    </view>

    <view
      class="chip"
      :class="{ active: isActive }"
      :style="{ fontSize: `${fontSize}rpx`, letterSpacing: `${spacing}rpx` }"
    >
      动态 class 与 style 绑定
    </view>
  </view>
</template>

<style scoped>
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a202c;
}

.hint {
  display: block;
  color: #718096;
  font-size: 24rpx;
  margin-bottom: 16rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.label {
  color: #2d3748;
  font-size: 26rpx;
}

.value {
  color: #4a5568;
  font-size: 26rpx;
}

.buttons {
  display: flex;
  gap: 12rpx;
  margin: 12rpx 0 18rpx;
}

.chip {
  background: #edf2f7;
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  color: #2d3748;
  transition: all 0.2s ease;
}

.chip.active {
  background: #3182ce;
  color: #ffffff;
}
</style>
