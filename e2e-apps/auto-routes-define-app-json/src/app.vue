<script setup lang="ts">
import type { AutoRoutesAppGlobalData, AutoRoutesAppInstance } from './types/auto-routes'
import routes from 'weapp-vite/auto-routes'

const globalData: AutoRoutesAppGlobalData = {
  __autoRoutesPages: routes.pages,
  __autoRoutesEntries: routes.entries,
  __autoRoutesSubPackages: routes.subPackages,
}

defineAppSetup((app) => {
  const runtimeApp = app as unknown as AutoRoutesAppInstance
  runtimeApp.routes = routes
  runtimeApp.globalData = {
    ...(runtimeApp.globalData ?? {}),
    ...globalData,
  }
})

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
  window: {
    navigationBarTitleText: 'auto-routes-define-app-json',
  },
})
</script>
