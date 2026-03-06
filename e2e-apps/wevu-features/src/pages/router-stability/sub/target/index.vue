<script setup lang="ts">
import { onLoad, ref } from 'wevu'

const source = ref('unknown')

onLoad((options) => {
  source.value = options?.source ?? 'unknown'
})

function goBack() {
  wx.navigateBack({
    delta: 1,
  })
}

const _goBack = goBack
</script>

<template>
  <view class="router-sub-target-page">
    <view id="router-target-sub-marker">
      route=pages/router-stability/sub/target/index source={{ source }}
    </view>
  </view>
</template>

<style scoped>
.router-sub-target-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  color: #0f172a;
  background: #fef3c7;
}
</style>
