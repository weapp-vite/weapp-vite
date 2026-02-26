<script setup lang="ts">
defineAppJson({
  $schema: 'https://vite.icebreaker.top/app.json',
  pages: [
    'pages/index/index',
    'pages/wevu/index',
    'pages/config-ts/index',
    'pages/config-js/index',
    'pages/vue-compat/index',
    'pages/vue-compat/template/index',
    'pages/vue-compat/reactivity/index',
    'pages/vue-compat/script-setup/index',
    'pages/vue-compat/component-interop/index',
    'pages/vue-compat/matrix/index',
    'pages/api-demos/base/index',
    'pages/api-demos/device/index',
    'pages/api-demos/media/index',
    'pages/api-demos/network/index',
    'pages/api-demos/ui/index',
    'pages/api-demos/storage/index',
    'pages/api-demos/file/index',
    'pages/api-demos/location/index',
    'pages/api-demos/canvas/index',
    'pages/api-demos/wxml/index',
    'pages/api-demos/route/index',
    'pages/api-demos/navigate/index',
    'pages/api-demos/open-api/index',
    'pages/api-demos/share/index',
    'pages/api-demos/payment/index',
    'pages/api-demos/ad/index',
    'pages/api-demos/data-analysis/index',
    'pages/api-demos/chattool/index',
    'pages/api-demos/worker/index',
    'pages/api-demos/ai/index',
    'pages/api-demos/ext/index',
    'pages/api-demos/cloud/index',
    'pages/api-demos/misc/index',
  ],
  window: {
    navigationBarTitleText: 'WeVU .vue Demo',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

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
