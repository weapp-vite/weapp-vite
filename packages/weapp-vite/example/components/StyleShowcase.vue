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
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
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
}

.scoped {
  padding: 14rpx;
  border-radius: 10rpx;
  background: #f7fafc;
  color: #2d3748;
}

.scoped.active {
  border: 2rpx solid #2b6cb0;
}
</style>

<style module>
.title {
  padding: 14rpx;
  border-radius: 10rpx;
  background: linear-gradient(135deg, #805ad5, #63b3ed);
  color: #ffffff;
  font-weight: 600;
}

.highlight {
  box-shadow: 0 12rpx 24rpx rgba(99, 179, 237, 0.35);
  transform: translateY(-2rpx);
}
</style>
