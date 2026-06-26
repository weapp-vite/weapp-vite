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
    <slot />
  </view>
</template>

<style>
.app-vue-hmr-alias-app {
  min-height: 100vh;
}
</style>
