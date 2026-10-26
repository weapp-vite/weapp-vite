import { installMiniProgramGlobals } from '@weapp-vite/web/runtime'

const trace = {
  errors: [] as string[],
  rejections: [] as Array<{ reason: unknown, promiseMatches: boolean, reasonMatches: boolean }>,
  themes: [] as string[],
}
let publishSnapshot: ((snapshot: string) => unknown) | undefined
let expectedPromise: Promise<unknown> | undefined
let expectedReason: unknown

function publish() {
  publishSnapshot?.(JSON.stringify(trace))
}

function errorHandler(error: string) {
  trace.errors.push(error)
  publish()
}

function rejectionHandler(event: { reason: unknown, promise: Promise<unknown> }) {
  trace.rejections.push({
    reason: event.reason,
    promiseMatches: event.promise === expectedPromise,
    reasonMatches: event.reason === expectedReason,
  })
  publish()
}

function themeHandler(event: { theme: string }) {
  trace.themes.push(event.theme)
  publish()
}

Page({
  data: { ready: '', snapshot: '' },
  onLoad() {
    publishSnapshot = snapshot => this.setData({ snapshot })
    wx.hideHomeButton()
    wx.hideShareMenu()
    this.setData({ ready: 'ready' })
    publish()
  },
  onUnload() {
    wx.offError(errorHandler)
    wx.offUnhandledRejection(rejectionHandler)
    wx.offThemeChange(themeHandler)
    publishSnapshot = undefined
  },
  subscribe() {
    wx.onError(errorHandler)
    wx.onUnhandledRejection(rejectionHandler)
    wx.onThemeChange(themeHandler)
  },
  unsubscribe() {
    wx.offError()
    wx.offUnhandledRejection()
    wx.offThemeChange()
  },
  dispatch() {
    const error = new Error('browser fixture error')
    error.stack = 'issue-1250 error stack'
    window.dispatchEvent(new ErrorEvent('error', { error, message: 'unused message', cancelable: true }))
    window.dispatchEvent(new ErrorEvent('error', { message: 'issue-1250 message only', cancelable: true }))
    expectedPromise = Promise.resolve('tracked promise')
    expectedReason = { code: 'fixture-reason', nested: { count: 2 } }
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
      promise: expectedPromise,
      reason: expectedReason,
      cancelable: true,
    }))
  },
  reinstall() {
    installMiniProgramGlobals()
    installMiniProgramGlobals()
  },
  async toastSequence() {
    await wx.showToast({ title: 'first toast', icon: 'none', duration: 100 })
    await wx.hideToast()
    await wx.showToast({ title: 'second toast', icon: 'none', duration: 1000 })
  },
  hideToast() {
    wx.hideToast()
  },
})
