<script setup lang="ts">
import { onHide, onLaunch, onShow } from 'wevu'

defineAppJson({
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'weapp-vite 演示录屏',
    navigationBarBackgroundColor: '#1f7aec',
    navigationBarTextStyle: 'white',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

onLaunch(() => {
  console.log('[recording-demo] app launch')
})

onShow(() => {
  console.log('[recording-demo] app show')
})

onHide(() => {
  console.log('[recording-demo] app hide')
})
</script>

<style src="./app.css"></style>
