<script setup lang="ts">
import { wpi } from '@wevu/api'
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

const logger = wpi.getLogManager({ level: 1 })

const router = createRouter({
  routes: autoRoutes.entries.map(path => ({
    name: path,
    path: `/${path}`,
  })),
})

router.beforeEach((to, from) => {
  logger.info('[wevu-template-router] beforeEach', {
    to: to?.fullPath,
    from: from.fullPath,
  })
  return true
})

router.beforeResolve((to, from) => {
  logger.info('[wevu-template-router] beforeResolve', {
    to: to?.fullPath,
    from: from.fullPath,
  })
  return true
})

router.afterEach((to, from, failure) => {
  logger.info('[wevu-template-router] afterEach', {
    to: to?.fullPath,
    from: from.fullPath,
    failureType: failure?.type,
  })
})

router.onError((error, context) => {
  logger.info('[wevu-template-router] onError', {
    error: error instanceof Error ? error.message : String(error),
    mode: context.mode,
    to: context.to?.fullPath,
    from: context.from.fullPath,
    failureType: context.failure.type,
  })
})

onShow(() => {
  logger.info('[weapp-vite-wevu-template] app show')
})

onHide(() => {
  logger.info('[weapp-vite-wevu-template] app hide')
})

onLaunch(() => {
  logger.info('[weapp-vite-wevu-template] app launch')
})
</script>

<style>
page {
  color: #0f172a;
  background: #f3f6fb;
}
</style>
