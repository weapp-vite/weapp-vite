<script setup lang="ts">
import { onAppShow } from 'wevu'

defineAppJson({
  $schema: 'https://vite.icebreaker.top/app.json',
  pages: [
    'pages/index/index',
  ],
  window: {
    navigationBarTitleText: 'WeVU Template',
    navigationBarBackgroundColor: '#4c6ef5',
    navigationBarTextStyle: 'white',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

onAppShow(() => {
  console.log('[weapp-vite-wevu-template] app show')
})
</script>

<style>
page {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
    sans-serif;
  color: #1c1c3c;
  background: #f6f7fb;
}
</style>
