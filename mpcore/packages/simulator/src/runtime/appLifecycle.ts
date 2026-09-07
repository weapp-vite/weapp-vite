import type {
  HeadlessWxAppHideCallback,
  HeadlessWxAppHideOptions,
  HeadlessWxAppShowCallback,
  HeadlessWxLaunchOptions,
} from '../host'
import type { HeadlessAppInstance } from './appInstance'

export function cloneHeadlessWxLaunchOptions(options: HeadlessWxLaunchOptions): HeadlessWxLaunchOptions {
  return {
    ...options,
    query: { ...options.query },
    referrerInfo: {
      ...options.referrerInfo,
      extraData: { ...options.referrerInfo.extraData },
    },
  }
}

export class HeadlessAppLifecycle {
  private readonly hideCallbacks = new Set<HeadlessWxAppHideCallback>()
  private readonly showCallbacks = new Set<HeadlessWxAppShowCallback>()

  close() {
    this.hideCallbacks.clear()
    this.showCallbacks.clear()
  }

  offAppHide(callback?: HeadlessWxAppHideCallback) {
    if (callback) {
      this.hideCallbacks.delete(callback)
      return
    }
    this.hideCallbacks.clear()
  }

  offAppShow(callback?: HeadlessWxAppShowCallback) {
    if (callback) {
      this.showCallbacks.delete(callback)
      return
    }
    this.showCallbacks.clear()
  }

  onAppHide(callback: HeadlessWxAppHideCallback) {
    this.hideCallbacks.add(callback)
  }

  onAppShow(callback: HeadlessWxAppShowCallback) {
    this.showCallbacks.add(callback)
  }

  triggerAppHide(app: HeadlessAppInstance, options: HeadlessWxAppHideOptions) {
    const callbacks = [...this.hideCallbacks]
    app.onHide?.(options)
    for (const callback of callbacks) {
      callback(options)
    }
  }

  triggerAppShow(app: HeadlessAppInstance, options: HeadlessWxLaunchOptions) {
    const callbacks = [...this.showCallbacks]
    app.onShow?.(options)
    for (const callback of callbacks) {
      callback(options)
    }
  }
}
