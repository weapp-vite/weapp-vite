<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/detail/index',
    'pages/update/index',
  ],
  window: {
    navigationBarTitleText: 'Vue Runtime Bench',
    navigationBarBackgroundColor: '#0f766e',
    navigationBarTextStyle: 'white',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

onLaunch(() => {})
</script>

<style src="./app.css"></style>
