<script lang="ts">
import { QueryClient, VUE_QUERY_CLIENT } from '@tanstack/vue-query'
import { provide } from 'wevu'

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

export default {}
</script>

<script setup lang="ts">
// eslint-disable-next-line import/first
import routes from 'weapp-vite/auto-routes'

provide(VUE_QUERY_CLIENT, queryClient)

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
