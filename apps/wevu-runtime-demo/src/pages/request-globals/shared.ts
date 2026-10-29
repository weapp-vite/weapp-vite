export type RequestGlobalsDemoTransport = 'fetch' | 'graphql-request' | 'axios'
export type RequestGlobalsDemoStatus = 'idle' | 'running' | 'success' | 'error'

export interface RequestGlobalsDemoState {
  pageStatus: string
  payload: string
  responseClient: string
  responseSource: string
  requestLog: string[]
  runCount: number
  status: RequestGlobalsDemoStatus
}

export const REQUEST_GLOBALS_STATE_STORAGE_KEY = '__weapp_vite_request_globals_state__'

type MockHeadersListener = Parameters<WechatMiniprogram.RequestTask['onHeadersReceived']>[0]
type MockChunkListener = Parameters<WechatMiniprogram.RequestTask['onChunkReceived']>[0]

let originalRequest: typeof wx.request | undefined

function formatRequestLog(options: WechatMiniprogram.RequestOption) {
  const entries = [
    String(options.method ?? 'GET').toUpperCase(),
    String(options.url ?? ''),
  ]

  const miniProgramFields = [
    ['timeout', (options as WechatMiniprogram.RequestOption & { timeout?: number }).timeout],
    ['enableHttp2', (options as WechatMiniprogram.RequestOption & { enableHttp2?: boolean }).enableHttp2],
    ['enableChunked', (options as WechatMiniprogram.RequestOption & { enableChunked?: boolean }).enableChunked],
    ['forceCellularNetwork', (options as WechatMiniprogram.RequestOption & { forceCellularNetwork?: boolean }).forceCellularNetwork],
  ] as const

  for (const [key, value] of miniProgramFields) {
    if (value !== undefined) {
      entries.push(`${key}=${String(value)}`)
    }
  }

  return entries.join(' ')
}

function createMockResponse(url: string, data: unknown) {
  if (url.endsWith('/fetch')) {
    return {
      data: JSON.stringify({
        transport: 'fetch',
        source: 'request-globals',
        echo: data ?? null,
      }),
      header: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    }
  }

  if (url.endsWith('/axios')) {
    return {
      data: JSON.stringify({
        transport: 'axios',
        source: 'request-globals',
      }),
      header: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    }
  }

  return {
    data: JSON.stringify({
      data: {
        transport: {
          client: 'graphql-request',
          source: 'request-globals',
        },
      },
    }),
    header: {
      'content-type': 'application/json',
    },
    statusCode: 200,
  }
}

export function createInitialState(): RequestGlobalsDemoState {
  return {
    pageStatus: '待执行',
    payload: '',
    responseClient: '',
    responseSource: '',
    requestLog: [],
    runCount: 0,
    status: 'idle',
  }
}

export function syncRequestGlobalsDemoState(route: string, state: RequestGlobalsDemoState) {
  try {
    wx.setStorageSync(REQUEST_GLOBALS_STATE_STORAGE_KEY, {
      ...state,
      route,
    })
  }
  catch {
    // e2e 探针不应影响页面运行。
  }
}

export function installMockRequest(onLog: (entry: string) => void) {
  if (originalRequest) {
    return
  }

  originalRequest = wx.request
  ;(wx as typeof wx & { request: typeof wx.request }).request = ((options: WechatMiniprogram.RequestOption) => {
    const url = String(options.url ?? '')
    const headersListeners = new Set<MockHeadersListener>()
    const chunkListeners = new Set<MockChunkListener>()
    let finished = false
    onLog(formatRequestLog(options))

    function clearListeners() {
      headersListeners.clear()
      chunkListeners.clear()
    }

    const timer = setTimeout(() => {
      const result = createMockResponse(url, options.data)
      if (options.enableChunked) {
        for (const listener of headersListeners) {
          listener({ statusCode: result.statusCode, header: result.header, cookies: [] })
        }
        if (finished) {
          return
        }
        const data = new TextEncoder().encode(result.data).buffer
        for (const listener of chunkListeners) {
          listener({ data })
        }
      }
      if (finished) {
        return
      }
      finished = true
      options.success?.(result as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
      options.complete?.(result as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
      clearListeners()
    }, 18)

    return {
      abort() {
        if (finished) {
          return
        }
        finished = true
        clearTimeout(timer)
        clearListeners()
        const aborted = {
          errMsg: 'request:fail abort',
        }
        options.fail?.(aborted as unknown as WechatMiniprogram.RequestFailCallbackErr)
        options.complete?.(aborted as unknown as WechatMiniprogram.GeneralCallbackResult)
      },
      offChunkReceived(listener?: MockChunkListener) {
        if (listener) {
          chunkListeners.delete(listener)
        }
        else {
          chunkListeners.clear()
        }
      },
      offHeadersReceived(listener?: MockHeadersListener) {
        if (listener) {
          headersListeners.delete(listener)
        }
        else {
          headersListeners.clear()
        }
      },
      onChunkReceived(listener: MockChunkListener) {
        if (!finished) {
          chunkListeners.add(listener)
        }
      },
      onHeadersReceived(listener: MockHeadersListener) {
        if (!finished) {
          headersListeners.add(listener)
        }
      },
    } as unknown as WechatMiniprogram.RequestTask
  }) as typeof wx.request
}

export function restoreMockRequest() {
  if (!originalRequest) {
    return
  }
  ;(wx as typeof wx & { request: typeof wx.request }).request = originalRequest
  originalRequest = undefined
}

export function createSuccessState(payload: string): Pick<RequestGlobalsDemoState, 'pageStatus' | 'payload' | 'status' | 'responseClient' | 'responseSource'> {
  const parsed = JSON.parse(payload) as { transport?: string | { client?: string, source?: string }, source?: string }
  const response = typeof parsed.transport === 'object' ? parsed.transport : parsed
  return {
    pageStatus: '全部通过',
    payload,
    responseClient: typeof parsed.transport === 'string' ? parsed.transport : parsed.transport?.client ?? '',
    responseSource: response.source ?? '',
    status: 'success',
  }
}

export function createErrorState(error: unknown): Pick<RequestGlobalsDemoState, 'pageStatus' | 'payload' | 'status'> {
  return {
    pageStatus: '校验失败',
    payload: error instanceof Error ? error.message : String(error),
    status: 'error',
  }
}
