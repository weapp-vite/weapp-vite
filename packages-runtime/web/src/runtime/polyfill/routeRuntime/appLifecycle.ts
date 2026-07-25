import type { AppLaunchOptions, AppRuntime, PageStackEntry } from './options'
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
  #foreground = false
  #lastEnterOptions: AppLaunchOptions | undefined
  #launchOptions: AppLaunchOptions | undefined
  #launched = false
  #visibilityDocument: VisibilityDocument | undefined
  #visibilityHandler: (() => void) | undefined

  constructor(private readonly resolveCurrentEntry: () => PageStackEntry | undefined) {}

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
    const options = resolveEntryOptions(entry)
    this.#launchOptions = cloneLaunchOptions(options)
    this.#lastEnterOptions = cloneLaunchOptions(options)
    this.#foreground = true
    this.#launched = true
    this.#appInstance.onLaunch?.(cloneLaunchOptions(options))
    this.#appInstance.onShow?.(cloneLaunchOptions(options))
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
      this.#appInstance.onHide?.()
      this.#foreground = false
      return
    }
    if (this.#foreground) {
      return
    }
    const options = resolveEntryOptions(this.resolveCurrentEntry())
    this.#lastEnterOptions = cloneLaunchOptions(options)
    this.#appInstance.onShow?.(cloneLaunchOptions(options))
    this.#foreground = true
  }

  #unbindVisibility() {
    if (this.#visibilityDocument && this.#visibilityHandler) {
      this.#visibilityDocument.removeEventListener('visibilitychange', this.#visibilityHandler)
    }
    this.#visibilityDocument = undefined
    this.#visibilityHandler = undefined
  }
}
