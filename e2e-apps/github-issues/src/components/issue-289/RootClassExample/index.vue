<script setup lang="ts">
import { computed } from 'wevu'

const props = defineProps<{
  showOptions: boolean
  selectedOptionId: string
}>()

const root = {
  a: 'aaaa',
}

interface RootOption {
  id: string
  label: string
  className: string
}

const options: RootOption[] = [
  {
    id: 'root-a',
    label: '主样式',
    className: 'aaaa',
  },
  {
    id: 'root-b',
    label: '次样式',
    className: 'bbbb',
  },
  {
    id: 'root-c',
    label: '警告样式',
    className: 'cccc',
  },
]

const selectedClassName = computed(() => options.find(item => item.id === props.selectedOptionId)?.className ?? root.a)
</script>

<template>
  <view class="root-class-box">
    <view v-if="showOptions" class="root-options">
      <view
        v-for="option in options"
        :key="option.id"
        class="root-option"
        :class="option.id === selectedOptionId ? 'root-option-active' : 'root-option-idle'"
      >
        {{ option.label }}
      </view>
    </view>

    <view v-if="root" id="issue289-root-class-value" :class="selectedClassName">
      root class: {{ selectedClassName }}
    </view>

    <view v-if="!showOptions" class="root-options-tip">
      options hidden
    </view>
  </view>
</template>

<style scoped>
.root-class-box {
  margin-top: 20rpx;
}

.root-options {
  margin: 12rpx 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.root-option {
  min-height: 52rpx;
  line-height: 52rpx;
  padding: 0 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
  color: #334155;
  background: #e2e8f0;
}

.root-option-active {
  color: #ffffff;
  background: #0ea5e9;
}

.root-option-idle {
  opacity: 0.76;
}

.aaaa {
  margin-top: 8rpx;
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #155e75;
  background: #cffafe;
}

.bbbb {
  margin-top: 8rpx;
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #7c2d12;
  background: #ffedd5;
}

.cccc {
  margin-top: 8rpx;
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #9f1239;
  background: #ffe4e6;
}

.root-options-tip {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #64748b;
}
</style>
