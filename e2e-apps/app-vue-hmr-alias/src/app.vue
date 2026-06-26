<script setup lang="ts">
import { defineAppSetup, ref } from 'wevu'
import { bootstrapApp } from '@/bootstrap'

const bootstrapLabel = ref(bootstrapApp())

defineAppJson({
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'app vue hmr alias',
  },
})

defineAppSetup((app) => {
  app.globalData = {
    ...(app.globalData ?? {}),
    bootstrapLabel: bootstrapLabel.value,
  }
})
</script>

<template>
  <view class="app-vue-hmr-alias-app">
    <text class="app-vue-hmr-alias-app__marker">
      APP-VUE-HMR-ALIAS-APP-BASE
    </text>
    <text class="app-vue-hmr-alias-app__bootstrap">
      {{ bootstrapLabel }}
    </text>
    <slot />
  </view>
</template>

<style>
.app-vue-hmr-alias-app {
  min-height: 100vh;
}

.app-vue-hmr-alias-app__marker {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #334155;
}

.app-vue-hmr-alias-app__bootstrap {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #475569;
}
</style>
