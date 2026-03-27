import type {
  HeadlessWxGetNetworkTypeResult,
  HeadlessWxNetworkStatusChangeCallback,
  HeadlessWxNetworkStatusChangeResult,
  HeadlessWxNetworkType,
  HeadlessWxRequestOption,
  HeadlessWxRequestSuccessResult,
  HeadlessWxRequestTask,
  HeadlessWxShowActionSheetOption,
  HeadlessWxShowActionSheetResult,
  HeadlessWxShowLoadingOption,
  HeadlessWxShowModalOption,
  HeadlessWxShowModalResult,
  HeadlessWxShowToastOption,
} from '../host'
import { Buffer } from 'node:buffer'

export interface HeadlessWxLoadingSnapshot {
  mask: boolean
  title: string
}

export interface HeadlessWxToastSnapshot {
  duration: number
  icon: string
  mask: boolean
  title: string
}

export interface HeadlessWxNetworkSnapshot extends HeadlessWxNetworkStatusChangeResult {}

export interface HeadlessWxActionSheetMockDefinition {
  cancel?: boolean
  tapIndex?: number
}

export interface HeadlessWxActionSheetLogEntry {
  itemList: string[]
  result?: HeadlessWxShowActionSheetResult
}

export interface HeadlessWxModalMockDefinition {
  cancel?: boolean
  confirm?: boolean
}

export interface HeadlessWxModalLogEntry {
  cancelColor: string
  cancelText: string
  confirmColor: string
  confirmText: string
  content: string
  result: HeadlessWxShowModalResult
  showCancel: boolean
  title: string
}

export interface HeadlessWxRequestMockDefinition {
  delay?: number
  header?: Record<string, string>
  method?: string
  response:
    | unknown
    | ((option: HeadlessWxRequestOption) => unknown)
  statusCode?: number
  url: RegExp | string
}

export interface HeadlessWxRequestLogEntry {
  data: unknown
  header: Record<string, string>
  matched: boolean
  method: string
  response?: HeadlessWxRequestSuccessResult
  url: string
}

const STORAGE_LIMIT_SIZE = 10 * 1024
const DEFAULT_MODAL_CANCEL_COLOR = '#000000'
const DEFAULT_MODAL_CANCEL_TEXT = '取消'
const DEFAULT_MODAL_CONFIRM_COLOR = '#576B95'
const DEFAULT_MODAL_CONFIRM_TEXT = '确定'

function createNetworkSnapshot(networkType: HeadlessWxNetworkType): HeadlessWxNetworkSnapshot {
  return {
    isConnected: networkType !== 'none',
    networkType,
  }
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeMethod(method?: string) {
  return (method || 'GET').trim().toUpperCase()
}

function isRequestSuccessResult(value: unknown): value is Partial<HeadlessWxRequestSuccessResult> & { data: unknown } {
  return !!value && typeof value === 'object' && 'data' in value
}

function matchesRequestMock(mock: HeadlessWxRequestMockDefinition, option: HeadlessWxRequestOption) {
  const requestMethod = normalizeMethod(option.method)
  const mockMethod = normalizeMethod(mock.method)
  if (mock.method && requestMethod !== mockMethod) {
    return false
  }

  if (typeof mock.url === 'string') {
    return mock.url === option.url
  }

  mock.url.lastIndex = 0
  return mock.url.test(option.url)
}

function resolveRequestResponse(
  mock: HeadlessWxRequestMockDefinition,
  option: HeadlessWxRequestOption,
): HeadlessWxRequestSuccessResult {
  const rawResponse = typeof mock.response === 'function'
    ? mock.response(option)
    : mock.response

  if (isRequestSuccessResult(rawResponse)) {
    return {
      cookies: Array.isArray(rawResponse.cookies) ? [...rawResponse.cookies] : [],
      data: cloneValue(rawResponse.data),
      errMsg: rawResponse.errMsg ?? 'request:ok',
      header: { ...rawResponse.header },
      statusCode: rawResponse.statusCode ?? mock.statusCode ?? 200,
    }
  }

  return {
    cookies: [],
    data: cloneValue(rawResponse),
    errMsg: 'request:ok',
    header: { ...(mock.header ?? {}) },
    statusCode: mock.statusCode ?? 200,
  }
}

export function createHeadlessWxState() {
  const actionSheetLogs: HeadlessWxActionSheetLogEntry[] = []
  const actionSheetMocks: HeadlessWxActionSheetMockDefinition[] = []
  const modalLogs: HeadlessWxModalLogEntry[] = []
  const networkStatusChangeCallbacks = new Set<HeadlessWxNetworkStatusChangeCallback>()
  const modalMocks: HeadlessWxModalMockDefinition[] = []
  const requestLogs: HeadlessWxRequestLogEntry[] = []
  const requestMocks: HeadlessWxRequestMockDefinition[] = []
  const storage = new Map<string, unknown>()
  let loading: HeadlessWxLoadingSnapshot | null = null
  let networkType: HeadlessWxNetworkType = 'wifi'
  let toast: HeadlessWxToastSnapshot | null = null

  return {
    clearStorageSync() {
      storage.clear()
    },
    getActionSheetLogs() {
      return actionSheetLogs.map(entry => ({
        ...entry,
        itemList: [...entry.itemList],
        result: entry.result ? { ...entry.result } : undefined,
      }))
    },
    getNetworkType(): HeadlessWxGetNetworkTypeResult {
      return {
        errMsg: 'getNetworkType:ok',
        networkType,
      }
    },
    getModalLogs() {
      return modalLogs.map(entry => ({
        ...entry,
        result: { ...entry.result },
      }))
    },
    getRequestLogs() {
      return requestLogs.map(entry => ({
        ...entry,
        data: cloneValue(entry.data),
        header: { ...entry.header },
        response: entry.response
          ? {
              ...entry.response,
              cookies: [...entry.response.cookies],
              data: cloneValue(entry.response.data),
              header: { ...entry.response.header },
            }
          : undefined,
      }))
    },
    getStorageInfoSync() {
      const keys = Array.from(storage.keys()).sort((a, b) => a.localeCompare(b))
      const totalBytes = Array.from(storage.entries()).reduce((sum, [key, value]) => {
        return sum + Buffer.byteLength(JSON.stringify([key, value]))
      }, 0)
      return {
        currentSize: Math.ceil(totalBytes / 1024),
        errMsg: 'getStorageInfo:ok',
        keys,
        limitSize: STORAGE_LIMIT_SIZE,
      }
    },
    getStorageSnapshot() {
      return Object.fromEntries(
        Array.from(storage.entries(), ([key, value]) => [key, cloneValue(value)]),
      )
    },
    getStorageSync(key: string) {
      return cloneValue(storage.get(key))
    },
    getLoading() {
      return loading ? { ...loading } : null
    },
    getToast() {
      return toast ? { ...toast } : null
    },
    hideLoading() {
      loading = null
      return {
        errMsg: 'hideLoading:ok',
      }
    },
    hideToast() {
      toast = null
      return {
        errMsg: 'hideToast:ok',
      }
    },
    offNetworkStatusChange(callback?: HeadlessWxNetworkStatusChangeCallback) {
      if (!callback) {
        networkStatusChangeCallbacks.clear()
        return
      }
      networkStatusChangeCallbacks.delete(callback)
    },
    mockRequest(definition: HeadlessWxRequestMockDefinition) {
      requestMocks.push({
        ...definition,
        delay: definition.delay,
        header: definition.header ? { ...definition.header } : undefined,
      })
    },
    mockModal(definition: HeadlessWxModalMockDefinition = {}) {
      modalMocks.push({
        cancel: definition.cancel,
        confirm: definition.confirm,
      })
    },
    mockActionSheet(definition: HeadlessWxActionSheetMockDefinition = {}) {
      actionSheetMocks.push({
        cancel: definition.cancel,
        tapIndex: definition.tapIndex,
      })
    },
    onNetworkStatusChange(callback: HeadlessWxNetworkStatusChangeCallback) {
      networkStatusChangeCallbacks.add(callback)
    },
    removeStorageSync(key: string) {
      storage.delete(key)
    },
    request(option: HeadlessWxRequestOption): HeadlessWxRequestTask {
      const matchedMock = requestMocks.find(mock => matchesRequestMock(mock, option))
      if (!matchedMock) {
        const logEntry: HeadlessWxRequestLogEntry = {
          data: cloneValue(option.data),
          header: { ...(option.header ?? {}) },
          matched: false,
          method: normalizeMethod(option.method),
          url: option.url,
        }
        requestLogs.push(logEntry)
        const error = new Error(`No request mock matched in headless runtime: ${normalizeMethod(option.method)} ${option.url}`)
        option.fail?.(error)
        option.complete?.()
        return {
          abort() {},
        }
      }

      const response = resolveRequestResponse(matchedMock, option)
      const requestLogEntry: HeadlessWxRequestLogEntry = {
        data: cloneValue(option.data),
        header: { ...(option.header ?? {}) },
        matched: true,
        method: normalizeMethod(option.method),
        response,
        url: option.url,
      }
      const delay = Number.isFinite(matchedMock.delay)
        ? Math.max(0, Math.trunc(matchedMock.delay ?? 0))
        : 0

      if (delay <= 0) {
        requestLogs.push(requestLogEntry)
        option.success?.(response)
        option.complete?.(response)
        return {
          abort() {},
        }
      }

      let completed = false
      const timer = setTimeout(() => {
        if (completed) {
          return
        }
        completed = true
        requestLogs.push(requestLogEntry)
        option.success?.(response)
        option.complete?.(response)
      }, delay)

      return {
        abort() {
          if (completed) {
            return
          }
          completed = true
          clearTimeout(timer)
          const error = new Error('request:fail abort')
          option.fail?.(error)
          option.complete?.()
        },
      }
    },
    setStorageSync(key: string, value: unknown) {
      storage.set(key, cloneValue(value))
    },
    setNetworkType(nextNetworkType: HeadlessWxNetworkType) {
      networkType = nextNetworkType
      const snapshot = createNetworkSnapshot(networkType)
      networkStatusChangeCallbacks.forEach(callback => callback({ ...snapshot }))
      return {
        errMsg: 'getNetworkType:ok',
        networkType,
      }
    },
    showActionSheet(option: HeadlessWxShowActionSheetOption) {
      const itemList = Array.isArray(option.itemList)
        ? option.itemList.filter((item): item is string => typeof item === 'string')
        : []

      if (itemList.length === 0) {
        throw new Error('showActionSheet:fail invalid itemList')
      }

      const nextMock = actionSheetMocks.shift()
      if (nextMock?.cancel) {
        actionSheetLogs.push({
          itemList: [...itemList],
        })
        throw new Error('showActionSheet:fail cancel')
      }

      const tapIndex = Number.isInteger(nextMock?.tapIndex)
        ? Number(nextMock?.tapIndex)
        : 0

      if (tapIndex < 0 || tapIndex >= itemList.length) {
        throw new Error('showActionSheet:fail invalid tapIndex')
      }

      const result: HeadlessWxShowActionSheetResult = {
        errMsg: 'showActionSheet:ok',
        tapIndex,
      }

      actionSheetLogs.push({
        itemList: [...itemList],
        result: { ...result },
      })

      return result
    },
    showLoading(option: HeadlessWxShowLoadingOption) {
      loading = {
        mask: Boolean(option.mask),
        title: option.title,
      }
      return {
        errMsg: 'showLoading:ok',
      }
    },
    showModal(option: HeadlessWxShowModalOption) {
      const showCancel = option.showCancel !== false
      const nextMock = modalMocks.shift()
      let confirm = nextMock?.confirm ?? true
      let cancel = nextMock?.cancel ?? !confirm

      if (!showCancel) {
        confirm = true
        cancel = false
      }
      else if (confirm) {
        cancel = false
      }
      else {
        cancel = true
      }

      const result: HeadlessWxShowModalResult = {
        cancel,
        confirm,
        errMsg: 'showModal:ok',
      }

      modalLogs.push({
        cancelColor: option.cancelColor ?? DEFAULT_MODAL_CANCEL_COLOR,
        cancelText: option.cancelText ?? DEFAULT_MODAL_CANCEL_TEXT,
        confirmColor: option.confirmColor ?? DEFAULT_MODAL_CONFIRM_COLOR,
        confirmText: option.confirmText ?? DEFAULT_MODAL_CONFIRM_TEXT,
        content: option.content,
        result: { ...result },
        showCancel,
        title: option.title ?? '',
      })

      return result
    },
    showToast(option: HeadlessWxShowToastOption) {
      toast = {
        duration: Number(option.duration ?? 1500),
        icon: option.icon ?? 'success',
        mask: Boolean(option.mask),
        title: option.title,
      }
      return {
        errMsg: 'showToast:ok',
      }
    },
  }
}
