<script setup lang="ts">
import autoRoutes from 'weapp-vite/auto-routes'

const bootstrapPage = 'pages/bootstrap/index'
const pages = [
  bootstrapPage,
  ...autoRoutes.pages.filter(page => page !== bootstrapPage),
]

defineAppJson({
  pages,
  window: {
    navigationBarTitleText: 'Wot UI compatibility',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
})
</script>

<style>
page {
  color: #1f2329;
  background: #f5f6f8;
}
</style>
