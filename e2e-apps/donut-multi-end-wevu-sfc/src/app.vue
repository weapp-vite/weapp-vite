<script setup lang="ts">
import autoRoutes from 'weapp-vite/auto-routes'
import { computed, defineAppSetup, onLaunch, provide, ref } from 'wevu'
import { createRouter } from 'wevu/router'

const APP_PROVIDE_KEY = 'donut-multi-end-wevu-sfc:app'
const launchCount = ref(0)
const appSummary = computed(() => ({
  fixture: 'donut-multi-end-wevu-sfc',
  routeCount: autoRoutes.pages.length,
  launchCount: launchCount.value,
}))

defineAppJson({
  pages: autoRoutes.pages,
  window: {
    navigationBarTitleText: 'Wevu 多端 E2E',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
})

createRouter({
  routes: autoRoutes.entries.map(path => ({
    name: path,
    path: `/${path}`,
  })),
})

defineAppSetup((app) => {
  app.provide(APP_PROVIDE_KEY, appSummary)
})
provide(APP_PROVIDE_KEY, appSummary)

onLaunch(() => {
  launchCount.value += 1
})
</script>

<style>
page {
  color: #172033;
  background: #f5f7fb;
}
</style>
