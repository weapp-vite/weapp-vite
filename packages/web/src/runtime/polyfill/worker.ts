type WorkerMessageCallback = (result: { data: unknown }) => void
type WorkerErrorCallback = (error: {
  message: string
  filename?: string
  lineno?: number
  colno?: number
}) => void

function resolveWorkerPath(path: unknown) {
  const normalized = typeof path === 'string' ? path.trim() : ''
  if (!normalized) {
    throw new TypeError('createWorker:fail invalid scriptPath')
  }
  try {
    const runtimeLocation = (typeof location !== 'undefined' ? location : undefined) as { href?: string } | undefined
    const base = runtimeLocation?.href
    if (base) {
      return new URL(normalized, base).toString()
    }
  }
  catch {
    // fallback to raw path
  }
  return normalized
}

export function createWorkerBridge(path: string) {
  const WorkerCtor = (globalThis as { Worker?: typeof Worker }).Worker
  if (typeof WorkerCtor !== 'function') {
    throw new TypeError('createWorker:fail Worker is unavailable')
  }
  const scriptPath = resolveWorkerPath(path)

  let nativeWorker: Worker
  try {
    nativeWorker = new WorkerCtor(scriptPath)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new TypeError(`createWorker:fail ${message}`)
  }

  const messageCallbacks = new Set<WorkerMessageCallback>()
  const errorCallbacks = new Set<WorkerErrorCallback>()

  const handleMessage = (event: MessageEvent<unknown>) => {
    for (const callback of messageCallbacks) {
      callback({ data: event?.data })
    }
  }
  const handleError = (event: ErrorEvent) => {
    const payload = {
      message: event?.message ?? 'unknown error',
      filename: event?.filename,
      lineno: event?.lineno,
      colno: event?.colno,
    }
    for (const callback of errorCallbacks) {
      callback(payload)
    }
  }

  if (typeof nativeWorker.addEventListener === 'function') {
    nativeWorker.addEventListener('message', handleMessage as EventListener)
    nativeWorker.addEventListener('error', handleError as EventListener)
  }
  else {
    nativeWorker.onmessage = handleMessage as ((this: AbstractWorker, ev: MessageEvent) => any)
    nativeWorker.onerror = handleError as ((this: AbstractWorker, ev: ErrorEvent) => any)
  }

  return {
    postMessage(data: unknown) {
      nativeWorker.postMessage(data)
    },
    terminate() {
      nativeWorker.terminate()
      messageCallbacks.clear()
      errorCallbacks.clear()
    },
    onMessage(callback: WorkerMessageCallback) {
      if (typeof callback === 'function') {
        messageCallbacks.add(callback)
      }
    },
    offMessage(callback?: WorkerMessageCallback) {
      if (typeof callback !== 'function') {
        messageCallbacks.clear()
        return
      }
      messageCallbacks.delete(callback)
    },
    onError(callback: WorkerErrorCallback) {
      if (typeof callback === 'function') {
        errorCallbacks.add(callback)
      }
    },
    offError(callback?: WorkerErrorCallback) {
      if (typeof callback !== 'function') {
        errorCallbacks.clear()
        return
      }
      errorCallbacks.delete(callback)
    },
  }
}
