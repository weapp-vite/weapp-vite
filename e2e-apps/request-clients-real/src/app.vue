<script lang="ts">
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { pages, subPackages } from 'weapp-vite/auto-routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000,
      retry: false,
      staleTime: 0,
    },
  },
})

queryClient.mount()
</script>

<script setup lang="ts">
defineAppSetup((app) => {
  app.use(VueQueryPlugin, {
    queryClient,
  })
})

defineAppJson({
  pages,
  subPackages,
  window: {
    navigationBarTitleText: 'request-clients-real',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#e2e8f0',
  },
  style: 'v2',
})
</script>

<style>
page {
  color: #0f172a;
  background: #e2e8f0;
}
</style>
