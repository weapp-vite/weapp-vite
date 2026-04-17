import type { MiniProgramAsyncOptions, MiniProgramBaseResult } from './base'

export interface ShowToastOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  title?: string
  icon?: 'success' | 'error' | 'none'
  duration?: number
}

export interface SetClipboardDataOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  data?: string
}

export interface GetClipboardDataSuccessResult extends MiniProgramBaseResult {
  data: string
}

export interface GetClipboardDataOptions extends MiniProgramAsyncOptions<GetClipboardDataSuccessResult> {}

export interface SetStorageOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  key?: string
  data?: any
}

export interface GetStorageSuccessResult extends MiniProgramBaseResult {
  data: any
}

export interface GetStorageOptions extends MiniProgramAsyncOptions<GetStorageSuccessResult> {
  key?: string
}

export interface RemoveStorageOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  key?: string
}

export interface StorageInfoResult extends MiniProgramBaseResult {
  keys: string[]
  currentSize: number
  limitSize: number
}

export interface FileReadResult extends MiniProgramBaseResult {
  data: string | ArrayBuffer
}

export interface FileWriteOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  filePath?: string
  data?: string | ArrayBuffer | ArrayBufferView
  encoding?: string
}

export interface FileReadOptions extends MiniProgramAsyncOptions<FileReadResult> {
  filePath?: string
  encoding?: string
}

export interface FileSystemManager {
  writeFile: (options?: FileWriteOptions) => void
  readFile: (options?: FileReadOptions) => void
  writeFileSync: (filePath: string, data: string | ArrayBuffer | ArrayBufferView, encoding?: string) => void
  readFileSync: (filePath: string, encoding?: string) => string | ArrayBuffer
}

export type WorkerMessageCallback = (result: { data: unknown }) => void
export type WorkerErrorCallback = (result: { message: string, filename?: string, lineno?: number, colno?: number }) => void

export interface WorkerBridge {
  postMessage: (data: unknown) => void
  terminate: () => void
  onMessage: (callback: WorkerMessageCallback) => void
  offMessage: (callback?: WorkerMessageCallback) => void
  onError: (callback: WorkerErrorCallback) => void
  offError: (callback?: WorkerErrorCallback) => void
}

export interface RequestSuccessResult extends MiniProgramBaseResult {
  data: any
  statusCode: number
  header: Record<string, string>
}

export interface RequestOptions extends MiniProgramAsyncOptions<RequestSuccessResult> {
  url?: string
  method?: string
  data?: any
  header?: Record<string, string>
  timeout?: number
  dataType?: 'json' | 'text'
  responseType?: 'text' | 'arraybuffer'
}

export interface DownloadFileSuccessResult extends MiniProgramBaseResult {
  tempFilePath: string
  statusCode: number
}

export interface DownloadFileOptions extends MiniProgramAsyncOptions<DownloadFileSuccessResult> {
  url?: string
  header?: Record<string, string>
  timeout?: number
}

export interface UploadFileSuccessResult extends MiniProgramBaseResult {
  data: string
  statusCode: number
  header: Record<string, string>
}

export interface UploadFileOptions extends MiniProgramAsyncOptions<UploadFileSuccessResult> {
  url?: string
  filePath?: string
  name?: string
  header?: Record<string, string>
  formData?: Record<string, unknown>
  timeout?: number
}

export interface PreviewImageOptions extends MiniProgramAsyncOptions<MiniProgramBaseResult> {
  current?: string
  urls?: string[]
}

export interface ChooseImageTempFile {
  path: string
  size: number
  type: string
  name: string
}

export interface ChooseImageSuccessResult extends MiniProgramBaseResult {
  tempFilePaths: string[]
  tempFiles: ChooseImageTempFile[]
}

export interface ChooseImageOptions extends MiniProgramAsyncOptions<ChooseImageSuccessResult> {
  count?: number
  sizeType?: Array<'original' | 'compressed'>
  sourceType?: Array<'album' | 'camera'>
}
