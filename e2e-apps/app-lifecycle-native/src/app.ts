import { APP_HOOKS, finalizeAppLifecycle, recordAppLifecycle } from './shared/lifecycle'

const SOURCE = 'app.native'

App({
  globalData: {
    __lifecycleLogs: [],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
  },
  onLaunch(options) {
    recordAppLifecycle(this, 'onLaunch', [options], { source: SOURCE })
  },
  onShow(options) {
    recordAppLifecycle(this, 'onShow', [options], { source: SOURCE })
  },
  onHide() {
    recordAppLifecycle(this, 'onHide', [], { source: SOURCE })
  },
  onError(error) {
    recordAppLifecycle(this, 'onError', [error], { source: SOURCE })
  },
  onPageNotFound(options) {
    recordAppLifecycle(this, 'onPageNotFound', [options], { source: SOURCE })
  },
  onUnhandledRejection(reason) {
    recordAppLifecycle(this, 'onUnhandledRejection', [reason], { source: SOURCE })
  },
  onThemeChange(options) {
    recordAppLifecycle(this, 'onThemeChange', [options], { source: SOURCE })
  },
  finalizeLifecycleLogs() {
    return finalizeAppLifecycle(this, APP_HOOKS, { source: SOURCE })
  },
})
