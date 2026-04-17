import type {
  CanvasContext,
  DownloadFileOptions,
  FileSystemManager,
  GetStorageOptions,
  LoadSubPackageOptions,
  MiniProgramAsyncOptions,
  MiniProgramBaseResult,
  NavigateToMiniProgramOptions,
  PageScrollToOptions,
  PreloadSubpackageOptions,
  RemoveStorageOptions,
  RequestOptions,
  SelectorQuery,
  SetStorageOptions,
  StorageInfoResult,
  UploadFileOptions,
  VideoContext,
  VkSession,
  WorkerBridge,
} from './types'
import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
} from './async'
import { createCanvasContextBridge } from './canvasContext'
import {
  downloadFileByFetchBridge,
  requestByFetchBridge,
  uploadFileByFetchBridge,
} from './network'
import {
  clearStorageSyncBridge,
  createFileSystemManagerBridgeApi,
  createVKSessionBridgeApi,
  createWorkerBridgeApi,
  getStorageInfoSyncBridge,
  getStorageSyncBridge,
  removeStorageSyncBridge,
  setStorageSyncBridge,
} from './runtimeInfra'
import {
  hideKeyboardBridge,
  loadSubPackageBridge,
  nextTickBridge,
  pageScrollToBridge,
  preloadSubpackageBridge,
  startPullDownRefreshBridge,
  stopPullDownRefreshBridge,
} from './runtimeOps'
import { createSelectorQueryBridge } from './selectorQuery'
import {
  clearStorageBridge,
  getStorageBridge,
  getStorageInfoBridge,
  removeStorageBridge,
  setStorageBridge,
} from './storageAsync'
import { createVideoContextBridge } from './videoContext'

const fileSystemManagerBridge: FileSystemManager = createFileSystemManagerBridgeApi(
  (options: any, result: any) => callMiniProgramAsyncSuccess(
    options as unknown as MiniProgramAsyncOptions<MiniProgramBaseResult> | undefined,
    result as MiniProgramBaseResult,
  ),
  (options: any, errMsg: any) => callMiniProgramAsyncFailure(
    options as unknown as MiniProgramAsyncOptions<MiniProgramBaseResult> | undefined,
    errMsg,
  ),
) as FileSystemManager

export function navigateToMiniProgram(options?: NavigateToMiniProgramOptions) {
  const appId = options?.appId?.trim() ?? ''
  if (!appId) {
    const failure = callMiniProgramAsyncFailure(options, 'navigateToMiniProgram:fail invalid appId')
    return Promise.reject(failure)
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'navigateToMiniProgram:ok' }))
}

export function exitMiniProgram(options?: MiniProgramAsyncOptions<MiniProgramBaseResult>) {
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'exitMiniProgram:ok' }))
}

export function nextTick(callback?: () => void) {
  return nextTickBridge(callback)
}

export function startPullDownRefresh(options?: MiniProgramAsyncOptions<MiniProgramBaseResult>) {
  return startPullDownRefreshBridge(options)
}

export function stopPullDownRefresh(options?: MiniProgramAsyncOptions<MiniProgramBaseResult>) {
  return stopPullDownRefreshBridge(options)
}

export function hideKeyboard(options?: MiniProgramAsyncOptions<MiniProgramBaseResult>) {
  return hideKeyboardBridge(options)
}

export function loadSubPackage(options?: LoadSubPackageOptions) {
  return loadSubPackageBridge(options)
}

export function preloadSubpackage(options?: PreloadSubpackageOptions) {
  return preloadSubpackageBridge(options)
}

export function pageScrollTo(options?: PageScrollToOptions) {
  return pageScrollToBridge(options)
}

export function createSelectorQuery(): SelectorQuery {
  return createSelectorQueryBridge()
}

export function createCanvasContext(canvasId: string): CanvasContext {
  return createCanvasContextBridge(canvasId)
}

export function createVideoContext(videoId: string): VideoContext {
  return createVideoContextBridge(videoId)
}

export function setStorageSync(key: string, data: any) {
  return setStorageSyncBridge(key, data)
}

export function getStorageSync(key: string) {
  return getStorageSyncBridge(key)
}

export function removeStorageSync(key: string) {
  return removeStorageSyncBridge(key)
}

export function clearStorageSync() {
  return clearStorageSyncBridge()
}

export function getStorageInfoSync(): StorageInfoResult {
  return getStorageInfoSyncBridge() as StorageInfoResult
}

export function setStorage(options?: SetStorageOptions) {
  return setStorageBridge(options)
}

export function getStorage(options?: GetStorageOptions) {
  return getStorageBridge(options)
}

export function removeStorage(options?: RemoveStorageOptions) {
  return removeStorageBridge(options)
}

export function clearStorage(options?: MiniProgramAsyncOptions<MiniProgramBaseResult>) {
  return clearStorageBridge(options)
}

export function getStorageInfo(options?: MiniProgramAsyncOptions<StorageInfoResult>) {
  return getStorageInfoBridge(options)
}

export function getFileSystemManager() {
  return fileSystemManagerBridge
}

export function createWorker(path: string): WorkerBridge {
  return createWorkerBridgeApi(path) as WorkerBridge
}

export function createVKSession(_options?: Record<string, unknown>): VkSession {
  return createVKSessionBridgeApi() as VkSession
}

export async function request(options?: RequestOptions) {
  return requestByFetchBridge(options)
}

export async function downloadFile(options?: DownloadFileOptions) {
  return downloadFileByFetchBridge(options)
}

export async function uploadFile(options?: UploadFileOptions) {
  return uploadFileByFetchBridge(options)
}
