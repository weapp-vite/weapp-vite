<script setup lang="ts">
import { onHide, onLaunch, onShow } from 'wevu'

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/typecheck-errors/index',
  ],
  window: {
    navigationBarTitleText: 'wevu-bug',
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
page {
  color: #1c1c3c;
  background: #f6f7fb;
}
</style>
