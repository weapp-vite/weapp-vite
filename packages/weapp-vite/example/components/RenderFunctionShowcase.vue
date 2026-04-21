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
</style>
