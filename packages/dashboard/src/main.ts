import { createApp } from 'vue'
import App from './App.vue'
import { normalizeRuntimeEvents } from './features/dashboard/utils/runtimeEvents'
import { router } from './router'
import './style.css'

function dispatchDashboardEvents(payload: unknown) {
  const validEvents = normalizeRuntimeEvents(payload)

  if (validEvents.length === 0) {
    return
  }

  window.__WEAPP_VITE_DASHBOARD_EVENTS__ = [
    ...(window.__WEAPP_VITE_DASHBOARD_EVENTS__ ?? []),
    ...validEvents,
  ]
  window.dispatchEvent(new CustomEvent('weapp-dashboard:event', { detail: validEvents }))
}

function applyAnalyzePayload(payload: any) {
  const current = payload?.current ?? payload
  const previous = payload?.previous ?? window.__WEAPP_VITE_PREVIOUS_ANALYZE_RESULT__ ?? null
  window.__WEAPP_VITE_ANALYZE_RESULT__ = current
  window.__WEAPP_VITE_PREVIOUS_ANALYZE_RESULT__ = previous
  window.dispatchEvent(new CustomEvent('weapp-analyze:update', { detail: { current, previous } }))
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
      applyAnalyzePayload(payload)
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
