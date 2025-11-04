import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

async function bootstrap() {
  if (import.meta.env.DEV && typeof window !== 'undefined' && !window.__WEAPP_VITE_ANALYZE_RESULT__) {
    const { mockAnalyzeResult } = await import('./mock-data')
    window.__WEAPP_VITE_ANALYZE_RESULT__ = mockAnalyzeResult
  }

  const app = createApp(App)

  app.config.errorHandler = (err, _instance, info) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[weapp-vite analyze] runtime error:', err, info ?? '')
    }
  }

  app.mount('#app')

  if (import.meta.hot) {
    import.meta.hot.on('weapp-analyze:update', (payload) => {
      window.__WEAPP_VITE_ANALYZE_RESULT__ = payload
      window.dispatchEvent(new CustomEvent('weapp-analyze:update'))
    })
  }
}

bootstrap().catch((error) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[weapp-vite analyze] failed to bootstrap dashboard', error)
  }
})
