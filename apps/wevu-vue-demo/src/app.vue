<script lang="ts">
App({
  globalData: {},
  onLaunch() {
    console.log('[wevu-vue-demo] app launched from app.vue')
  },
})
</script>

<style>
.page {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
    sans-serif;
  color: #1c1c3c;
}
</style>

<json>
{
  "$schema": "https://vite.icebreaker.top/app.json",
  "pages": [
    "pages/wevu/index",
    "pages/config-ts/index",
    "pages/config-js/index"
  ],
  "window": {
    "navigationBarTitleText": "WeVU .vue Demo"
  },
  "style": "v2",
  "componentFramework": "glass-easel",
  "sitemapLocation": "sitemap.json"
}
</json>
