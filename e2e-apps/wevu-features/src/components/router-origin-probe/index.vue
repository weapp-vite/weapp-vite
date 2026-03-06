<script setup lang="ts">
import { useNativeInstance } from 'wevu'

const props = defineProps<{
  title: string
}>()

const nativeInstance = useNativeInstance()

function navByRouter() {
  nativeInstance.router?.navigateTo({
    url: './target/index?source=component-router',
  })
}

function navByPageRouter() {
  nativeInstance.pageRouter?.navigateTo({
    url: './target/index?source=component-page-router',
  })
}

defineExpose({
  navByRouter,
  navByPageRouter,
})
</script>

<template>
  <view class="router-origin-probe">
    <view class="router-origin-probe__title">
      {{ props.title }}
    </view>

    <view id="cmp-router-nav" class="router-origin-probe__btn" @tap="navByRouter">
      this.router.navigateTo('./target/index')
    </view>
    <view id="cmp-page-router-nav" class="router-origin-probe__btn" @tap="navByPageRouter">
      this.pageRouter.navigateTo('./target/index')
    </view>
  </view>
</template>

<style scoped>
.router-origin-probe {
  padding: 16rpx;
  margin-top: 16rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 14rpx;
}

.router-origin-probe__title {
  font-size: 24rpx;
  color: #334155;
}

.router-origin-probe__btn {
  min-height: 56rpx;
  padding: 0 16rpx;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 56rpx;
  color: #1e293b;
  background: #e2e8f0;
  border-radius: 9999rpx;
}
</style>
