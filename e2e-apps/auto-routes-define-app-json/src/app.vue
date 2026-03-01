<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'

defineOptions({
  globalData: {
    __autoRoutesPages: routes.pages,
    __autoRoutesEntries: routes.entries,
    __autoRoutesSubPackages: routes.subPackages,
  },
})

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
  window: {
    navigationBarTitleText: 'auto-routes-define-app-json',
  },
})
</script>
