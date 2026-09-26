import type {
  HeadlessWxAppHideCallback,
  HeadlessWxAppHideOptions,
  HeadlessWxAppShowCallback,
  HeadlessWxLaunchOptions,
} from '../host'
import type { HeadlessAppInstance } from './appInstance'

export class HeadlessAppLifecycle {
  private readonly hideCallbacks: HeadlessWxAppHideCallback[] = []
  private readonly showCallbacks: HeadlessWxAppShowCallback[] = []
  private isInitialShow = true

  close() {
    this.hideCallbacks.length = 0
    this.showCallbacks.length = 0
  }

  offAppHide(callback?: HeadlessWxAppHideCallback) {
    if (!callback) {
      this.hideCallbacks.length = 0
      return
    }

    let retainedCount = 0
    for (const registeredCallback of this.hideCallbacks) {
      if (registeredCallback !== callback) {
        this.hideCallbacks[retainedCount] = registeredCallback
        retainedCount += 1
      }
    }
    this.hideCallbacks.length = retainedCount
  }

  offAppShow(callback?: HeadlessWxAppShowCallback) {
    if (!callback) {
      this.showCallbacks.length = 0
      return
    }

    let retainedCount = 0
    for (const registeredCallback of this.showCallbacks) {
      if (registeredCallback !== callback) {
        this.showCallbacks[retainedCount] = registeredCallback
        retainedCount += 1
      }
    }
    this.showCallbacks.length = retainedCount
  }

  onAppHide(callback: HeadlessWxAppHideCallback) {
    this.hideCallbacks.push(callback)
  }

  onAppShow(callback: HeadlessWxAppShowCallback) {
    this.showCallbacks.push(callback)
  }

  triggerAppHide(app: HeadlessAppInstance, options: HeadlessWxAppHideOptions) {
    const callbacks = [...this.hideCallbacks]
    for (const callback of callbacks) {
      callback(options)
    }
    app.onHide?.(options)
  }

  triggerAppShow(app: HeadlessAppInstance, options: HeadlessWxLaunchOptions) {
    const callbacks = [...this.showCallbacks]
    const isInitialShow = this.isInitialShow
    this.isInitialShow = false

    if (isInitialShow) {
      app.onShow?.(options)
    }
    for (const callback of callbacks) {
      callback(options)
    }
    if (!isInitialShow) {
      app.onShow?.(options)
    }
  }
}
