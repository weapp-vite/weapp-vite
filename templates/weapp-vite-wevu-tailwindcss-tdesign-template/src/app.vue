<script setup lang="ts">
import { onHide, onLaunch, onShow } from 'wevu'

defineAppJson({
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'Wepp-Vite + WeVU Template',
    navigationBarBackgroundColor: '#4c6ef5',
    navigationBarTextStyle: 'white',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

onShow(() => {
  console.log('[weapp-vite-wevu-template] app show')
})

onHide(() => {
  console.log('[weapp-vite-wevu-template] app hide')
})

onLaunch(() => {
  console.log('[weapp-vite-wevu-template] app launch')
})
</script>

<style>
@tailwind base;
@tailwind components;
@tailwind utilities;
</style>
