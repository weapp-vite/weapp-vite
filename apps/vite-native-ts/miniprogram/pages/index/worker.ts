export interface WorkerLike {
  onError?: (callback: (error: unknown) => void) => void
  onMessage: (callback: (payload: unknown) => void) => void
  onProcessKilled?: (callback: () => void) => void
  terminate?: () => void
}

export interface WorkerApiLike {
  createWorker?: (path: string) => unknown
  preDownloadSubpackage?: (options: {
    packageType: 'workers'
    success?: () => void
    fail?: (error: unknown) => void
  }) => void
}

export interface PrepareWorkerOptions {
  workerPath: string
  workerSubpackage?: boolean
}

export interface PrepareWorkerResult {
  detail: string
  status: 'error' | 'ready' | 'unsupported'
  worker?: WorkerLike
}

function isWorkerLike(worker: unknown): worker is WorkerLike {
  if (!worker || typeof worker !== 'object') {
    return false
  }
  return typeof (worker as WorkerLike).onMessage === 'function'
}

async function preloadWorkerSubpackage(wxApi: WorkerApiLike) {
  if (typeof wxApi.preDownloadSubpackage !== 'function') {
    return
  }
  await new Promise<void>((resolve, reject) => {
    wxApi.preDownloadSubpackage?.({
      packageType: 'workers',
      success: () => resolve(),
      fail: error => reject(error),
    })
  })
}

function formatWorkerError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string' && error) {
    return error
  }
  try {
    return JSON.stringify(error)
  }
  catch {
    return String(error)
  }
}

export async function prepareWorker(
  wxApi: WorkerApiLike,
  options: PrepareWorkerOptions,
): Promise<PrepareWorkerResult> {
  if (typeof wxApi.createWorker !== 'function') {
    return {
      status: 'unsupported',
      detail: '当前环境不支持 wx.createWorker',
    }
  }

  try {
    if (options.workerSubpackage) {
      await preloadWorkerSubpackage(wxApi)
    }
  }
  catch (error) {
    return {
      status: 'error',
      detail: `worker 分包预下载失败：${formatWorkerError(error)}`,
    }
  }

  try {
    const worker = wxApi.createWorker(options.workerPath)
    if (!isWorkerLike(worker)) {
      return {
        status: 'unsupported',
        detail: '当前环境暂不支持完整 worker 能力',
      }
    }
    return {
      status: 'ready',
      detail: 'worker 已创建',
      worker,
    }
  }
  catch (error) {
    return {
      status: 'error',
      detail: `创建 worker 失败：${formatWorkerError(error)}`,
    }
  }
}
