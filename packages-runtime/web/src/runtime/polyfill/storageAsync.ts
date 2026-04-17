import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './types/base'
import type { GetStorageOptions, RemoveStorageOptions, SetStorageOptions, StorageInfoResult } from './types/common'
import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
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
    const failure = callMiniProgramAsyncFailure(options, 'setStorage:fail invalid key')
    return Promise.reject(failure)
  }
  try {
    setStorageSyncInternal(key, options?.data)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callMiniProgramAsyncFailure(options, `setStorage:fail ${message}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'setStorage:ok' }))
}

export function getStorageBridge(options?: GetStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callMiniProgramAsyncFailure(options, 'getStorage:fail invalid key')
    return Promise.reject(failure)
  }
  if (!hasStorageKey(key)) {
    const failure = callMiniProgramAsyncFailure(options, `getStorage:fail data not found for key ${key}`)
    return Promise.reject(failure)
  }
  const data = getStorageSyncInternal(key)
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'getStorage:ok', data }))
}

export function removeStorageBridge(options?: RemoveStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callMiniProgramAsyncFailure(options, 'removeStorage:fail invalid key')
    return Promise.reject(failure)
  }
  try {
    removeStorageSyncInternal(key)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callMiniProgramAsyncFailure(options, `removeStorage:fail ${message}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'removeStorage:ok' }))
}

export function clearStorageBridge(options?: MiniProgramAsyncOptions<MiniProgramBaseResult>) {
  clearStorageSyncInternal()
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'clearStorage:ok' }))
}

export function getStorageInfoBridge(options?: MiniProgramAsyncOptions<StorageInfoResult>) {
  return Promise.resolve(callMiniProgramAsyncSuccess(options, {
    ...getStorageInfoSyncInternal(),
    errMsg: 'getStorageInfo:ok',
  }))
}
