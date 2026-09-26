<script setup lang="ts">
import type { AutoRoutesAppGlobalData, AutoRoutesAppInstance } from './types/auto-routes'
import routes from 'weapp-vite/auto-routes'
import { getCurrentInstance } from 'wevu'

const globalData: AutoRoutesAppGlobalData = {
  __autoRoutesPages: routes.pages,
  __autoRoutesEntries: routes.entries,
  __autoRoutesSubPackages: routes.subPackages,
}

const app = getCurrentInstance() as unknown as AutoRoutesAppInstance
app.routes = routes
app.globalData = {
  ...(app.globalData ?? {}),
  ...globalData,
}

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
  window: {
    navigationBarTitleText: 'auto-routes-define-app-json',
  },
})
</script>
