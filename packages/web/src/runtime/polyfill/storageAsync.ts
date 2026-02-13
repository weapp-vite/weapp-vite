import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  clearStorageSyncInternal,
  getStorageInfoSyncInternal,
  getStorageSyncInternal,
  hasStorageKey,
  normalizeStorageKey,
  removeStorageSyncInternal,
  setStorageSyncInternal,
} from './storage'

export function setStorageBridge(options?: SetStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callWxAsyncFailure(options, 'setStorage:fail invalid key')
    return Promise.reject(failure)
  }
  try {
    setStorageSyncInternal(key, options?.data)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `setStorage:fail ${message}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'setStorage:ok' }))
}

export function getStorageBridge(options?: GetStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callWxAsyncFailure(options, 'getStorage:fail invalid key')
    return Promise.reject(failure)
  }
  if (!hasStorageKey(key)) {
    const failure = callWxAsyncFailure(options, `getStorage:fail data not found for key ${key}`)
    return Promise.reject(failure)
  }
  const data = getStorageSyncInternal(key)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'getStorage:ok', data }))
}

export function removeStorageBridge(options?: RemoveStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callWxAsyncFailure(options, 'removeStorage:fail invalid key')
    return Promise.reject(failure)
  }
  try {
    removeStorageSyncInternal(key)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `removeStorage:fail ${message}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'removeStorage:ok' }))
}

export function clearStorageBridge(options?: WxAsyncOptions<WxBaseResult>) {
  clearStorageSyncInternal()
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'clearStorage:ok' }))
}

export function getStorageInfoBridge(options?: WxAsyncOptions<StorageInfoResult>) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    ...getStorageInfoSyncInternal(),
    errMsg: 'getStorageInfo:ok',
  }))
}
