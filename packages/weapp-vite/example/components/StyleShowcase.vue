<script setup lang="ts">
import { ref } from 'vue'

interface StyleProps {
  initialHighlight?: boolean
}

const props = withDefaults(defineProps<StyleProps>(), {
  initialHighlight: false,
})

const highlight = ref(props.initialHighlight)

function toggle() {
  highlight.value = !highlight.value
}
</script>

<template>
  <view class="card">
    <text class="card-title">
      样式策略
    </text>
    <text class="hint">
      Scoped + CSS Modules
    </text>

    <view :class="[$style.title, { [$style.highlight]: highlight }]">
      使用 CSS Modules 生成的类名
    </view>

    <view class="scoped" :class="{ active: highlight }">
      Scoped 样式区域（继承 data-v 标记）
    </view>

    <button size="mini" @tap="toggle">
      切换高亮
    </button>
  </view>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 12rpx 32rpx rgb(0 0 0 / 6%);
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a202c;
}

.hint {
  display: block;
  font-size: 24rpx;
  color: #718096;
}

.scoped {
  padding: 14rpx;
  color: #2d3748;
  background: #f7fafc;
  border-radius: 10rpx;
}

.scoped.active {
  border: 2rpx solid #2b6cb0;
}
</style>

<style module>
.title {
  padding: 14rpx;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #805ad5, #63b3ed);
  border-radius: 10rpx;
}

.highlight {
  box-shadow: 0 12rpx 24rpx rgb(99 179 237 / 35%);
  transform: translateY(-2rpx);
}
</style>
