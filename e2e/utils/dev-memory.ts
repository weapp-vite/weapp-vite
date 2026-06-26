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
const DEFAULT_INSPECTOR_COMMAND_TIMEOUT_MS = 5_000

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

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

function waitForWebSocketOpen(socket: WebSocket, timeoutMs: number) {
  let onOpen: () => void
  let onError: () => void
  const task = new Promise<void>((resolve, reject) => {
    onOpen = () => resolve()
    onError = () => reject(new Error('Inspector WebSocket failed to open.'))
    socket.addEventListener('open', onOpen, { once: true })
    socket.addEventListener('error', onError, { once: true })
  }).finally(() => {
    socket.removeEventListener('open', onOpen)
    socket.removeEventListener('error', onError)
  })
  return withTimeout(task, timeoutMs, () => new Error(`Timed out opening inspector WebSocket after ${timeoutMs}ms.`))
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
  timeoutMs = DEFAULT_INSPECTOR_COMMAND_TIMEOUT_MS,
) {
  const task = new Promise<T>((resolve, reject) => {
    let onError: () => void
    let onMessage: (event: MessageEvent) => void
    let settled = false
    const settle = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      removeInspectorListeners(socket, onMessage, onError)
      callback()
    }
    onError = () => {
      settle(() => reject(new Error(`Inspector WebSocket failed while running ${method}.`)))
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

      if (payload.error) {
        settle(() => reject(new Error(payload.error.message ?? `Inspector command failed: ${method}`)))
        return
      }
      settle(() => resolve(payload.result as T))
    }

    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', onError, { once: true })
    socket.send(JSON.stringify({
      id: commandId,
      method,
      params,
    }))
  })
  return withTimeout(task, timeoutMs, () => new Error(`Timed out waiting for inspector command ${method} after ${timeoutMs}ms.`))
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

export async function sampleHeapAfterGc(
  inspectorUrl: string,
  timeoutMs = DEFAULT_INSPECTOR_COMMAND_TIMEOUT_MS,
): Promise<DevHeapUsage> {
  const socket = new WebSocket(inspectorUrl)
  try {
    await waitForWebSocketOpen(socket, timeoutMs)
    await sendInspectorCommand(socket, 1, 'HeapProfiler.collectGarbage', undefined, timeoutMs)
    const evaluated = await sendInspectorCommand<{
      result?: {
        value?: DevHeapUsage
      }
    }>(socket, 2, 'Runtime.evaluate', {
      expression: 'process.memoryUsage()',
      returnByValue: true,
    }, timeoutMs)
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

export function formatMemoryGuardReport(options: {
  after: DevHeapUsage
  before: DevHeapUsage
  label: string
  limitBytes: number
}) {
  const heapGrowth = options.after.heapUsed - options.before.heapUsed
  const rssGrowth = options.after.rss - options.before.rss
  return [
    `[memory-guard] label=${options.label}`,
    `heapBefore=${formatMemoryMiB(options.before.heapUsed)}`,
    `heapAfter=${formatMemoryMiB(options.after.heapUsed)}`,
    `heapGrowth=${formatMemoryMiB(heapGrowth)}`,
    `heapLimit=${formatMemoryMiB(options.limitBytes)}`,
    `rssBefore=${formatMemoryMiB(options.before.rss)}`,
    `rssAfter=${formatMemoryMiB(options.after.rss)}`,
    `rssGrowth=${formatMemoryMiB(rssGrowth)}`,
  ].join(' ')
}
