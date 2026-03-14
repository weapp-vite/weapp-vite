<script setup lang="ts">
import autoRoutes from 'weapp-vite/auto-routes'
import { onHide, onLaunch, onShow } from 'wevu'
import { createRouter } from 'wevu/router'

defineAppJson({
  pages: autoRoutes.pages,
  subPackages: autoRoutes.subPackages,
  window: {
    navigationBarTitleText: '业务模板',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

const router = createRouter({
  routes: autoRoutes.entries.map(path => ({
    name: path,
    path: `/${path}`,
  })),
})

router.beforeEach((to, from) => {
  console.log('[wevu-template-router] beforeEach', {
    to: to?.fullPath,
    from: from.fullPath,
  })
  return true
})

router.beforeResolve((to, from) => {
  console.log('[wevu-template-router] beforeResolve', {
    to: to?.fullPath,
    from: from.fullPath,
  })
  return true
})

router.afterEach((to, from, failure) => {
  console.log('[wevu-template-router] afterEach', {
    to: to?.fullPath,
    from: from.fullPath,
    failureType: failure?.type,
  })
})

router.onError((error, context) => {
  console.log('[wevu-template-router] onError', {
    error: error instanceof Error ? error.message : String(error),
    mode: context.mode,
    to: context.to?.fullPath,
    from: context.from.fullPath,
    failureType: context.failure.type,
  })
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
  color: #0f172a;
  background: #f3f6fb;
}
</style>
