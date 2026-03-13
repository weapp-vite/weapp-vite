<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { onLaunch } from 'wevu'
import { ensureWevuFeaturesRouter } from './shared/appRouter'

const extraPages = [
  'components/router-origin-probe/target/index',
] as const

defineAppJson({
  pages: [...routes.pages, ...extraPages],
  subPackages: routes.subPackages,
  window: {
    navigationBarTitleText: 'wevu-features',
  },
})

ensureWevuFeaturesRouter()

onLaunch(() => {})
</script>

<style>
.wevu-features-app-root {
  color: inherit;
}
</style>
