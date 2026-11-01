import { Buffer } from 'node:buffer'

interface InspectorResponse<T = unknown> {
  id?: number
  result?: T
  error?: {
    message?: string
  }
}

const DEFAULT_INSPECTOR_COMMAND_TIMEOUT_MS = 15_000

function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  createTimeoutError: () => Error,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(createTimeoutError()), timeoutMs)
  })
  return Promise.race([task, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

export function waitForWebSocketOpen(socket: WebSocket, timeoutMs: number) {
  let onOpen: () => void
  let onError: () => void
  let onClose: () => void
  const task = new Promise<void>((resolve, reject) => {
    onOpen = () => resolve()
    onError = () => reject(new Error('Inspector WebSocket failed to open.'))
    onClose = () => reject(new Error('Inspector WebSocket closed before opening.'))
    socket.addEventListener('open', onOpen, { once: true })
    socket.addEventListener('error', onError, { once: true })
    socket.addEventListener('close', onClose, { once: true })
  })
  return withTimeout(task, timeoutMs, () => new Error(`Timed out opening inspector WebSocket after ${timeoutMs}ms.`)).finally(() => {
    socket.removeEventListener('open', onOpen)
    socket.removeEventListener('error', onError)
    socket.removeEventListener('close', onClose)
  })
}

function removeInspectorListeners(
  socket: WebSocket,
  onMessage: (event: MessageEvent) => void,
  onError: () => void,
  onClose: () => void,
) {
  socket.removeEventListener('message', onMessage)
  socket.removeEventListener('error', onError)
  socket.removeEventListener('close', onClose)
}

function stringifySocketData(data: unknown) {
  if (typeof data === 'string') {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8')
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
  }
  return String(data)
}

export function sendInspectorCommand<T>(
  socket: WebSocket,
  commandId: number,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs = DEFAULT_INSPECTOR_COMMAND_TIMEOUT_MS,
) {
  return new Promise<T>((resolve, reject) => {
    let onError: () => void
    let onClose: () => void
    let onMessage: (event: MessageEvent) => void
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const settle = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      if (timer) {
        clearTimeout(timer)
      }
      removeInspectorListeners(socket, onMessage, onError, onClose)
      callback()
    }
    onError = () => {
      settle(() => reject(new Error(`Inspector WebSocket failed while running ${method}.`)))
    }
    onClose = () => {
      settle(() => reject(new Error(`Inspector WebSocket closed while running ${method}.`)))
    }
    onMessage = (event: MessageEvent) => {
      let payload: InspectorResponse<T>
      try {
        payload = JSON.parse(stringifySocketData(event.data)) as InspectorResponse<T>
      }
      catch (error) {
        settle(() => reject(error))
        return
      }
      if (payload.id !== commandId) {
        return
      }

      const responseError = payload.error
      if (responseError) {
        settle(() => reject(new Error(responseError.message ?? `Inspector command failed: ${method}`)))
        return
      }
      settle(() => resolve(payload.result as T))
    }

    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', onError, { once: true })
    socket.addEventListener('close', onClose, { once: true })
    timer = setTimeout(() => {
      settle(() => reject(new Error(`Timed out waiting for inspector command ${method} after ${timeoutMs}ms.`)))
    }, timeoutMs)
    try {
      socket.send(JSON.stringify({
        id: commandId,
        method,
        params,
      }))
    }
    catch (error) {
      settle(() => reject(error))
    }
  })
}
