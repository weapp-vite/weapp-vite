<script setup lang="ts">
import { onLoad, ref } from 'wevu'
import { wpi } from 'wevu/api'

const source = ref('unknown')
const E2E_ROUTER_TARGET_STORAGE_KEY = '__weapp_vite_router_target__'

onLoad((options) => {
  source.value = options?.source ?? 'unknown'
  try {
    wpi.setStorageSync(E2E_ROUTER_TARGET_STORAGE_KEY, {
      route: 'pages/router-stability/target/index',
      source: source.value,
    })
  }
  catch {
    // e2e 探针不应影响页面运行。
  }
})

function goBack() {
  wx.navigateBack({
    delta: 1,
  })
}

const _goBack = goBack
</script>

<template>
  <view class="router-target-page">
    <view id="router-target-main-marker">
      route=pages/router-stability/target/index source={{ source }}
    </view>
  </view>
</template>

<style scoped>
.router-target-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  color: #0f172a;
  background: #ecfeff;
}
</style>
