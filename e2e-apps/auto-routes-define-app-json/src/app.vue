<script setup lang="ts">
defineOptions({
  globalData: {
    __autoRoutesPages: [] as string[],
  },
})

defineAppJson(async () => {
  const routes = await import('weapp-vite/auto-routes')
  return {
    pages: routes.pages,
    window: {
      navigationBarTitleText: 'auto-routes-define-app-json',
    },
  }
})
</script>
