<script setup lang="ts">
import autoRoutes from 'weapp-vite/auto-routes'

defineAppJson({
  pages: autoRoutes.pages,
  window: {
    navigationBarTitleText: 'Wevu 模板',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})
</script>

<template>
  <view class="happy">
    <slot />
  </view>
</template>

<style>
.happy {
  min-height: 100vh;
}

page {
  color: #0f172a;
  background: #f3f6fb;
}
</style>
