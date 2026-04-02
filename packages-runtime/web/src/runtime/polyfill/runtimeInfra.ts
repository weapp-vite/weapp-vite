import {
  createFileSystemManagerBridge,
} from './fileSystemManager'
import {
  clearStorageSyncInternal,
  getStorageInfoSyncInternal,
  getStorageSyncInternal,
  normalizeStorageKey,
  removeStorageSyncInternal,
  setStorageSyncInternal,
} from './storage'
import { createVkSessionBridge } from './vkSession'
import { createWorkerBridge } from './worker'

export function setStorageSyncBridge(key: string, data: any) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('setStorageSync:fail invalid key')
  }
  setStorageSyncInternal(normalizedKey, data)
}

export function getStorageSyncBridge(key: string) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('getStorageSync:fail invalid key')
  }
  return getStorageSyncInternal(normalizedKey)
}

export function removeStorageSyncBridge(key: string) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('removeStorageSync:fail invalid key')
  }
  removeStorageSyncInternal(normalizedKey)
}

export function clearStorageSyncBridge() {
  clearStorageSyncInternal()
}

export function getStorageInfoSyncBridge() {
  return getStorageInfoSyncInternal()
}

export function createFileSystemManagerBridgeApi(onSuccess: any, onFailure: any): any {
  return createFileSystemManagerBridge(onSuccess, onFailure)
}

export function createWorkerBridgeApi(path: string) {
  return createWorkerBridge(path)
}

export function createVKSessionBridgeApi(): any {
  return createVkSessionBridge()
}
