import type { HeadlessWxCallbackOption } from './core'

export interface HeadlessWorker {
  onMessage: (listener: (message: any) => void) => void
  offMessage: (listener?: (message: any) => void) => void
  postMessage: (message: unknown) => void
  onError: (listener: (error: { message: string }) => void) => void
  offError: (listener?: (error: { message: string }) => void) => void
  terminate: () => void
}

export interface HeadlessWorkerApis {
  createWorker: (scriptPath: string) => HeadlessWorker
  preDownloadSubpackage: (options: HeadlessWxCallbackOption<{ errMsg: string }> & { packageType: 'workers' }) => void
}
