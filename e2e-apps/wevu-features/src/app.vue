<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { onLaunch, provide } from 'wevu'
import { ensureWevuFeaturesRouter } from './shared/appRouter'

const APP_PROVIDE_SCOPE_KEY = 'wevu-features:app-provide-scope'

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

provide(APP_PROVIDE_SCOPE_KEY, 'app-provide-value')

onLaunch(() => {})
</script>

<style>
.wevu-features-app-root {
  color: inherit;
}
</style>
