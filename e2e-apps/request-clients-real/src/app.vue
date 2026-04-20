<script setup lang="ts">
import { createRequestClientsRealHostTraceStore } from './shared/requestHostTrace'

const requestHostTrace = createRequestClientsRealHostTraceStore()

defineAppSetup((app) => {
  app.globalData = {
    ...(app.globalData ?? {}),
    requestHostTrace,
  }
})

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/fetch/index',
    'pages/axios/index',
    'pages/graphql-request/index',
    'pages/vue-query/index',
    'pages/socket-io/index',
    'pages/websocket/index',
  ],
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
