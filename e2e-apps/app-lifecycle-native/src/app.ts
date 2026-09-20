import { readHostLifecycle } from '../../shared/appLifecycle'
import { APP_HOOKS, finalizeAppLifecycle, recordAppLifecycle } from './shared/lifecycle'

const SOURCE = 'app.native'

App({
  readHostLifecycle,
  globalData: {
    __lifecycleLogs: [],
    __wxAppShowOrders: [] as number[],
    __lifecycleOrder: 0,
    __lifecycleSeen: {},
    __lifecycleState: {
      tick: 0,
      lastHook: '',
    },
  },
  onLaunch(options) {
    recordAppLifecycle(this, 'onLaunch', [options], { source: SOURCE })
    wx.onAppShow(() => {
      this.globalData.__wxAppShowOrders.push(this.globalData.__lifecycleOrder)
    })
  },
  onShow(options) {
    recordAppLifecycle(this, 'onShow', [options], { source: SOURCE })
  },
  onHide(...args: unknown[]) {
    recordAppLifecycle(this, 'onHide', args, { source: SOURCE })
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
