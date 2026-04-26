<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { defineAppSetup, onLaunch, provide } from 'wevu'
import { ensureWevuFeaturesRouter } from './shared/appRouter'

const APP_INSTANCE_PROVIDE_SCOPE_KEY = 'wevu-features:app-instance-provide-scope'
const APP_SETUP_PROVIDE_SCOPE_KEY = 'wevu-features:app-setup-provide-scope'

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

defineAppSetup((app) => {
  app.provide(APP_INSTANCE_PROVIDE_SCOPE_KEY, 'app-instance-provide-value')
})
provide(APP_SETUP_PROVIDE_SCOPE_KEY, 'app-setup-provide-value')

onLaunch(() => {})
</script>

<style>
.wevu-features-app-root {
  color: inherit;
}
</style>
