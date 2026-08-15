<script setup lang="ts">
defineAppJson({
  pages: ['pages/index/index'],
  window: {
    navigationBarTitleText: '多平台 SFC 模板',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
  },
  sitemapLocation: 'sitemap.json',
})
</script>

<style>
page {
  min-height: 100%;
  color: #17212b;
  background: #f4f6f8;
}
</style>
