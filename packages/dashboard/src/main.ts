import { createApp } from 'vue'
import App from './App.vue'
import { connectDashboardDevframe } from './features/dashboard/utils/dashboardDevframe'
import { router } from './router'
import './style.css'

function bootstrap() {
  const app = createApp(App)

  app.config.errorHandler = (err, _instance, info) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[weapp-vite analyze] runtime error:', err, info ?? '')
    }
  }

  app.use(router)
  app.mount('#app')

  void connectDashboardDevframe().catch((error) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[weapp-vite dashboard] Devframe 连接失败：', error)
    }
  })
}

try {
  bootstrap()
}
catch (error) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[weapp-vite analyze] failed to bootstrap dashboard', error)
  }
}
