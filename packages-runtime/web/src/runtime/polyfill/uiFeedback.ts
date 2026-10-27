import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './types'
import {
  callMiniProgramAsyncSuccess,
  normalizeDuration,
} from './async'
import {
  getLoadingElement,
  getToastElement,
  hideToastElement,
  resolveToastPrefix,
  setLoadingVisible,
  setToastVisible,
} from './ui'

let toastHideTimer: ReturnType<typeof setTimeout> | undefined
let toastGeneration = 0

function cancelToastTimer() {
  toastGeneration += 1
  if (toastHideTimer !== undefined) {
    clearTimeout(toastHideTimer)
    toastHideTimer = undefined
  }
}

export function showToastBridge(options?: any): Promise<any> {
  cancelToastTimer()
  const toast = getToastElement()
  const content = `${resolveToastPrefix(options?.icon)}${options?.title ?? ''}`.trim()
  if (toast) {
    toast.textContent = content
    setToastVisible(toast, true)
    const generation = toastGeneration
    const duration = normalizeDuration(options?.duration, 1500)
    toastHideTimer = setTimeout(() => {
      if (generation !== toastGeneration) {
        return
      }
      setToastVisible(toast, false)
      toastHideTimer = undefined
    }, duration)
  }
  const result = callMiniProgramAsyncSuccess(options, { errMsg: 'showToast:ok' })
  return Promise.resolve(result)
}

export function hideToastBridge(options?: MiniProgramAsyncOptions<MiniProgramBaseResult>): Promise<MiniProgramBaseResult> {
  cancelToastTimer()
  hideToastElement()
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'hideToast:ok' }))
}

export function showLoadingBridge(options?: any): Promise<any> {
  const loading = getLoadingElement()
  if (loading) {
    setLoadingVisible(
      loading,
      true,
      options?.title?.trim() || '加载中',
      Boolean(options?.mask),
    )
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'showLoading:ok' }))
}

export function hideLoadingBridge(options?: any): Promise<any> {
  const loading = getLoadingElement()
  if (loading) {
    setLoadingVisible(loading, false, loading.textContent ?? '', false)
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'hideLoading:ok' }))
}
