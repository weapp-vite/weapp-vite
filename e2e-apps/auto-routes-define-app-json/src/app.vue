<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'

defineOptions({
  globalData: {
    __autoRoutesPages: routes.pages,
  },
})

defineAppJson({
  pages: routes.pages,
  window: {
    navigationBarTitleText: 'auto-routes-define-app-json',
  },
})
</script>
