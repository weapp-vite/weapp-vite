<script setup lang="ts">
/* eslint-disable vue/define-macros-order */
import type { AutoRoutesAppGlobalData, AutoRoutesAppInstance } from './types/auto-routes'
import routes from 'weapp-vite/auto-routes'
import { getCurrentInstance, onLaunch } from 'wevu'

const globalData: AutoRoutesAppGlobalData = {
  __autoRoutesPages: routes.pages,
  __autoRoutesEntries: routes.entries,
  __autoRoutesSubPackages: routes.subPackages,
}

const app = getCurrentInstance() as AutoRoutesAppInstance | null

function syncAutoRoutesToAppInstance() {
  if (!app) {
    return
  }
  app.routes = routes
  app.globalData = {
    ...(app.globalData ?? {}),
    ...globalData,
  }
}

syncAutoRoutesToAppInstance()
onLaunch(() => {
  syncAutoRoutesToAppInstance()
})

defineOptions({
  // eslint-disable-next-line vue/valid-define-options
  globalData,
})

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
  window: {
    navigationBarTitleText: 'auto-routes-define-app-json',
  },
})
</script>
