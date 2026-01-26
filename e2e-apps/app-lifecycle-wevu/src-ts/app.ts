import {
  createApp,
  getCurrentInstance,
  onError,
  onHide,
  onLaunch,
  onPageNotFound,
  onShow,
  onThemeChange,
  onUnhandledRejection,
} from 'wevu'
import { APP_HOOKS, finalizeAppLifecycle, recordAppLifecycle } from './shared/lifecycle'

const SOURCE = 'app.wevu.ts'

createApp({
  setup() {
    const app = getCurrentInstance()
    if (!app) {
      return {}
    }
    ;(app as any).finalizeLifecycleLogs = () => finalizeAppLifecycle(app, APP_HOOKS, { source: SOURCE })

    onLaunch((options) => {
      recordAppLifecycle(app, 'onLaunch', [options], { source: SOURCE })
    })
    onShow((options) => {
      recordAppLifecycle(app, 'onShow', [options], { source: SOURCE })
    })
    onHide(() => {
      recordAppLifecycle(app, 'onHide', [], { source: SOURCE })
    })
    onError((error) => {
      recordAppLifecycle(app, 'onError', [error], { source: SOURCE })
    })
    onPageNotFound((options) => {
      recordAppLifecycle(app, 'onPageNotFound', [options], { source: SOURCE })
    })
    onUnhandledRejection((reason) => {
      recordAppLifecycle(app, 'onUnhandledRejection', [reason], { source: SOURCE })
    })
    onThemeChange((options) => {
      recordAppLifecycle(app, 'onThemeChange', [options], { source: SOURCE })
    })

    return {}
  },
})
