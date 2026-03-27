import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'

function dispatchDashboardEvents(payload: unknown) {
  const events = Array.isArray(payload) ? payload : [payload]
  const validEvents = events.filter(Boolean)

  if (validEvents.length === 0) {
    return
  }

  window.__WEAPP_VITE_DASHBOARD_EVENTS__ = [
    ...(window.__WEAPP_VITE_DASHBOARD_EVENTS__ ?? []),
    ...validEvents,
  ]
  window.dispatchEvent(new CustomEvent('weapp-dashboard:event', { detail: validEvents }))
}

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

  if (import.meta.hot) {
    import.meta.hot.on('weapp-analyze:update', (payload) => {
      window.__WEAPP_VITE_ANALYZE_RESULT__ = payload
      window.dispatchEvent(new CustomEvent('weapp-analyze:update'))
    })
    import.meta.hot.on('weapp-dashboard:event', (payload) => {
      dispatchDashboardEvents(payload)
    })
  }
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
