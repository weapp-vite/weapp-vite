import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
  normalizeDuration,
  scheduleMicrotask,
} from './async'
import { resolveSubPackageName } from './platformRuntime'
import { getPageContainer } from './routeRuntime/dom'

function resolveScrollTop(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return Math.max(0, value)
}

function setPageScrollTop(top: number) {
  const container = getPageContainer()
  if (container) {
    container.scrollTop = top
    return
  }
  if (typeof window !== 'undefined') {
    window.scrollTo?.(0, top)
  }
}

export function nextTickBridge(callback?: () => void) {
  if (typeof callback !== 'function') {
    return
  }
  scheduleMicrotask(() => callback())
}

export function startPullDownRefreshBridge(options?: any) {
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'startPullDownRefresh:ok' }))
}

export function stopPullDownRefreshBridge(options?: any) {
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'stopPullDownRefresh:ok' }))
}

export function hideKeyboardBridge(options?: any) {
  const activeElement = (typeof document !== 'undefined'
    ? (document as { activeElement?: { blur?: () => void } }).activeElement
    : undefined)
  if (activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur()
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'hideKeyboard:ok' }))
}

export function loadSubPackageBridge(options?: any) {
  const name = resolveSubPackageName(options)
  if (!name) {
    const failure = callMiniProgramAsyncFailure(options, 'loadSubPackage:fail invalid name')
    return Promise.reject(failure)
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'loadSubPackage:ok' }))
}

export function preloadSubpackageBridge(options?: any) {
  const name = resolveSubPackageName(options)
  if (!name) {
    const failure = callMiniProgramAsyncFailure(options, 'preloadSubpackage:fail invalid name')
    return Promise.reject(failure)
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'preloadSubpackage:ok' }))
}

export function pageScrollToBridge(options?: any) {
  const targetTop = resolveScrollTop(options?.scrollTop)
  const duration = normalizeDuration(options?.duration, 300)
  const run = () => setPageScrollTop(targetTop)

  if (duration <= 0) {
    run()
    return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'pageScrollTo:ok' }))
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      run()
      resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'pageScrollTo:ok' }))
    }, duration)
  })
}
