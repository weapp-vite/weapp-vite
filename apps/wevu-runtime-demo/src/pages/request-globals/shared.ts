export type RequestGlobalsDemoTransport = 'fetch' | 'graphql-request' | 'axios'
export type RequestGlobalsDemoStatus = 'idle' | 'running' | 'success' | 'error'

export interface RequestGlobalsDemoState {
  pageStatus: string
  payload: string
  requestLog: string[]
  runCount: number
  status: RequestGlobalsDemoStatus
}

let originalRequest: typeof wx.request | undefined

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
    requestLog: [],
    runCount: 0,
    status: 'idle',
  }
}

export function installMockRequest(onLog: (entry: string) => void) {
  if (originalRequest) {
    return
  }

  originalRequest = wx.request
  ;(wx as typeof wx & { request: typeof wx.request }).request = ((options: WechatMiniprogram.RequestOption) => {
    const method = String(options.method ?? 'GET').toUpperCase()
    const url = String(options.url ?? '')
    onLog(`${method} ${url}`)

    const timer = setTimeout(() => {
      const result = createMockResponse(url, options.data)
      options.success?.(result as WechatMiniprogram.RequestSuccessCallbackResult)
      options.complete?.(result as WechatMiniprogram.RequestSuccessCallbackResult)
    }, 18)

    return {
      abort() {
        clearTimeout(timer)
        const aborted = {
          errMsg: 'request:fail abort',
        }
        options.fail?.(aborted)
        options.complete?.(aborted)
      },
      offChunkReceived() {},
      onChunkReceived() {},
    } as WechatMiniprogram.RequestTask
  }) as typeof wx.request
}

export function restoreMockRequest() {
  if (!originalRequest) {
    return
  }
  ;(wx as typeof wx & { request: typeof wx.request }).request = originalRequest
  originalRequest = undefined
}

export function createSuccessState(payload: string): Pick<RequestGlobalsDemoState, 'pageStatus' | 'payload' | 'status'> {
  return {
    pageStatus: '全部通过',
    payload,
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
