import type { AppHideCallback, AppHideOptions, AppLaunchOptions, AppRuntime, AppShowCallback, PageStackEntry } from './options'
import { cloneLaunchOptions, resolveFallbackLaunchOptions } from '../appState'
import { isRecord } from './options'

type VisibilityDocument = Pick<Document, 'addEventListener' | 'hidden' | 'removeEventListener' | 'visibilityState'>

function resolveEntryOptions(entry: Pick<PageStackEntry, 'id' | 'query'> | undefined): AppLaunchOptions {
  return resolveFallbackLaunchOptions(entry ? [entry] : [])
}

function isDocumentHidden(target: VisibilityDocument) {
  return target.visibilityState === 'hidden' || target.hidden === true
}

export class AppLifecycleRuntime {
  #appInstance: AppRuntime | undefined
  readonly #hideCallbacks: AppHideCallback[] = []
  #foreground = false
  #lastEnterOptions: AppLaunchOptions | undefined
  #launchOptions: AppLaunchOptions | undefined
  #launched = false
  readonly #showCallbacks: AppShowCallback[] = []
  #visibilityDocument: VisibilityDocument | undefined
  #visibilityHandler: (() => void) | undefined

  constructor(private readonly resolveCurrentEntry: () => PageStackEntry | undefined) {}

  offAppHide(callback?: AppHideCallback) {
    if (!callback) {
      this.#hideCallbacks.length = 0
      return
    }

    let retainedCount = 0
    for (const registeredCallback of this.#hideCallbacks) {
      if (registeredCallback !== callback) {
        this.#hideCallbacks[retainedCount] = registeredCallback
        retainedCount += 1
      }
    }
    this.#hideCallbacks.length = retainedCount
  }

  offAppShow(callback?: AppShowCallback) {
    if (!callback) {
      this.#showCallbacks.length = 0
      return
    }

    let retainedCount = 0
    for (const registeredCallback of this.#showCallbacks) {
      if (registeredCallback !== callback) {
        this.#showCallbacks[retainedCount] = registeredCallback
        retainedCount += 1
      }
    }
    this.#showCallbacks.length = retainedCount
  }

  onAppHide(callback: AppHideCallback) {
    this.#hideCallbacks.push(callback)
  }

  onAppShow(callback: AppShowCallback) {
    this.#showCallbacks.push(callback)
  }

  register<T extends AppRuntime | undefined>(options: T): T {
    const resolved = (options ?? {}) as AppRuntime
    if (this.#appInstance) {
      const currentGlobal = this.#appInstance.globalData
      Object.assign(this.#appInstance, resolved)
      if (isRecord(currentGlobal)) {
        this.#appInstance.globalData = currentGlobal
      }
      else if (!isRecord(this.#appInstance.globalData)) {
        this.#appInstance.globalData = {}
      }
      return options
    }
    this.#appInstance = resolved
    if (!isRecord(this.#appInstance.globalData)) {
      this.#appInstance.globalData = {}
    }
    return options
  }

  bindVisibility(target: VisibilityDocument | undefined = typeof document === 'undefined' ? undefined : document) {
    if (!target || this.#visibilityDocument === target || typeof target.addEventListener !== 'function') {
      return
    }
    this.#unbindVisibility()
    this.#visibilityDocument = target
    this.#visibilityHandler = () => this.#syncVisibility(target)
    target.addEventListener('visibilitychange', this.#visibilityHandler)
  }

  ensureLaunched(entry: PageStackEntry) {
    if (!this.#appInstance || this.#launched) {
      return
    }
    const payload = resolveEntryOptions(entry)
    this.#launchOptions = cloneLaunchOptions(payload)
    this.#lastEnterOptions = cloneLaunchOptions(payload)
    this.#foreground = true
    this.#launched = true
    this.#appInstance.onLaunch?.(payload)
    this.#triggerAppShow(payload, true)
  }

  get instance() {
    return this.#appInstance
  }

  getLaunchOptions() {
    return this.#launchOptions
      ? cloneLaunchOptions(this.#launchOptions)
      : resolveEntryOptions(this.resolveCurrentEntry())
  }

  getEnterOptions() {
    return this.#lastEnterOptions
      ? cloneLaunchOptions(this.#lastEnterOptions)
      : this.getLaunchOptions()
  }

  dispose() {
    this.#hideCallbacks.length = 0
    this.#showCallbacks.length = 0
    this.#unbindVisibility()
  }

  #syncVisibility(target: VisibilityDocument) {
    if (!this.#appInstance || !this.#launched) {
      return
    }
    if (isDocumentHidden(target)) {
      if (!this.#foreground) {
        return
      }
      this.#foreground = false
      this.#triggerAppHide()
      return
    }
    if (this.#foreground) {
      return
    }
    const options = resolveEntryOptions(this.resolveCurrentEntry())
    this.#lastEnterOptions = cloneLaunchOptions(options)
    this.#foreground = true
    this.#triggerAppShow(options, false)
  }

  #triggerAppHide() {
    // 浏览器可见性事件无法区分微信退出方式，统一映射为“其他”。
    const options: AppHideOptions = { reason: 3 }
    const callbacks = [...this.#hideCallbacks]
    for (const callback of callbacks) {
      callback(options)
    }
    this.#appInstance?.onHide?.(options)
  }

  #triggerAppShow(options: AppLaunchOptions, isInitialShow: boolean) {
    const callbacks = [...this.#showCallbacks]
    if (isInitialShow) {
      this.#appInstance?.onShow?.(options)
    }
    for (const callback of callbacks) {
      callback(options)
    }
    if (!isInitialShow) {
      this.#appInstance?.onShow?.(options)
    }
  }

  #unbindVisibility() {
    if (this.#visibilityDocument && this.#visibilityHandler) {
      this.#visibilityDocument.removeEventListener('visibilitychange', this.#visibilityHandler)
    }
    this.#visibilityDocument = undefined
    this.#visibilityHandler = undefined
  }
}
