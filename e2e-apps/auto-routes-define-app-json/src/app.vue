<script setup lang="ts">
/* eslint-disable vue/define-macros-order */
import routes from 'weapp-vite/auto-routes'
import { getCurrentInstance, onLaunch } from 'wevu'

const globalData = {
  __autoRoutesPages: routes.pages,
  __autoRoutesEntries: routes.entries,
  __autoRoutesSubPackages: routes.subPackages,
}

interface AutoRoutesAppGlobalData {
  __autoRoutesPages?: string[]
  __autoRoutesEntries?: string[]
  __autoRoutesSubPackages?: Array<{ root: string, pages: string[] }>
}

interface AutoRoutesAppInstance {
  globalData?: AutoRoutesAppGlobalData
  routes?: typeof routes
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
