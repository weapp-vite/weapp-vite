import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'wevu'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000,
      retry: false,
      staleTime: 0,
    },
  },
})

const app = createApp({})

app.use(VueQueryPlugin, {
  queryClient,
})
