<script lang="ts">
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

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
// eslint-disable-next-line import/first
import routes from 'weapp-vite/auto-routes'
// eslint-disable-next-line import/first
import { use } from 'wevu'

use(VueQueryPlugin, {
  queryClient,
})

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
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
