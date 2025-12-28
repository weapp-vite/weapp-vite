<script setup lang="ts">
import DirectTsComponent from './render/DirectTsComponent'
import DirectTsxComponent from './render/DirectTsxComponent'

const props = withDefaults(
  defineProps<{
    tsTitle?: string
    tsxTitle?: string
  }>(),
  {
    tsTitle: 'TS Render 组件',
    tsxTitle: 'TSX 组件',
  },
)
</script>

<template>
  <view class="card">
    <text class="card-title">
      Render / TSX 组件
    </text>
    <text class="hint">
      直接 .ts render 函数与 .tsx JSX 写法
    </text>

    <DirectTsComponent :title="props.tsTitle" />
    <DirectTsxComponent :title="props.tsxTitle" />
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
</style>
