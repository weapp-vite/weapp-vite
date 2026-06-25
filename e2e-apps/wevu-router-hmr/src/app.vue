<script setup lang="ts">
import { createRouter } from 'wevu/router'

defineAppJson({
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'wevu-router-hmr',
  },
})

const router = createRouter({
  routes: [
    {
      name: 'index',
      path: '/pages/index/index',
    },
  ],
})

defineAppSetup((app) => {
  app.globalData = {
    ...(app.globalData ?? {}),
    routerReady: Boolean(router),
  }
})
</script>

<template>
  <view class="wevu-router-hmr-app">
    <slot />
  </view>
</template>

<style>
.wevu-router-hmr-app {
  min-height: 100vh;
}
</style>
