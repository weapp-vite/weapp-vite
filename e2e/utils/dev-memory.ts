import { Buffer } from 'node:buffer'

export interface DevHeapUsage {
  heapUsed: number
  rss: number
}

interface InspectorResponse<T = unknown> {
  id?: number
  result?: T
  error?: {
    message?: string
  }
}

const INSPECTOR_URL_RE = /Debugger listening on (ws:\/\/\S+)/

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function waitForWebSocketOpen(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error('Inspector WebSocket failed to open.')), { once: true })
  })
}

function removeInspectorListeners(
  socket: WebSocket,
  onMessage: (event: MessageEvent) => void,
  onError: () => void,
) {
  socket.removeEventListener('message', onMessage)
  socket.removeEventListener('error', onError)
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

function sendInspectorCommand<T>(
  socket: WebSocket,
  commandId: number,
  method: string,
  params?: Record<string, unknown>,
) {
  return new Promise<T>((resolve, reject) => {
    let onMessage: (event: MessageEvent) => void
    const onError = () => {
      removeInspectorListeners(socket, onMessage, onError)
      reject(new Error(`Inspector WebSocket failed while running ${method}.`))
    }
    onMessage = (event: MessageEvent) => {
      const payload = JSON.parse(stringifySocketData(event.data)) as InspectorResponse<T>
      if (payload.id !== commandId) {
        return
      }

      removeInspectorListeners(socket, onMessage, onError)
      if (payload.error) {
        reject(new Error(payload.error.message ?? `Inspector command failed: ${method}`))
        return
      }
      resolve(payload.result as T)
    }

    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', onError, { once: true })
    socket.send(JSON.stringify({
      id: commandId,
      method,
      params,
    }))
  })
}

export async function waitForInspectorUrl(
  getOutput: () => string,
  description: string,
  timeoutMs = 30_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const match = getOutput().match(INSPECTOR_URL_RE)
    if (match?.[1]) {
      return match[1]
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for inspector URL: ${description}`)
}

export async function sampleHeapAfterGc(inspectorUrl: string): Promise<DevHeapUsage> {
  const socket = new WebSocket(inspectorUrl)
  await waitForWebSocketOpen(socket)

  try {
    await sendInspectorCommand(socket, 1, 'HeapProfiler.collectGarbage')
    const evaluated = await sendInspectorCommand<{
      result?: {
        value?: DevHeapUsage
      }
    }>(socket, 2, 'Runtime.evaluate', {
      expression: 'process.memoryUsage()',
      returnByValue: true,
    })
    const usage = evaluated.result?.value
    if (!usage) {
      throw new Error('Inspector did not return process.memoryUsage().')
    }
    return usage
  }
  finally {
    socket.close()
  }
}

export function formatMemoryMiB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}
