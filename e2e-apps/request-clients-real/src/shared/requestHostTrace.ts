export interface RequestClientsRealRequestTrace {
  enableChunked?: boolean
  enableHttp2?: boolean
  forceCellularNetwork?: boolean
  method: string
  timeout?: number
  url: string
}

export interface RequestClientsRealSocketTrace {
  forceCellularNetwork?: boolean
  perMessageDeflate?: boolean
  protocols?: string[]
  timeout?: number
  url: string
}

export interface RequestClientsRealHostTraceStore {
  requestCalls: RequestClientsRealRequestTrace[]
  socketCalls: RequestClientsRealSocketTrace[]
}

const TRACE_LIMIT = 40

let hostTraceStore: RequestClientsRealHostTraceStore | undefined

function pushTrace<T>(target: T[], value: T) {
  target.push(value)
  if (target.length > TRACE_LIMIT) {
    target.shift()
  }
}

function normalizeMethod(value: unknown) {
  return String(value ?? 'GET').toUpperCase()
}

function normalizeProtocols(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.map(protocol => String(protocol))
}

export function createRequestClientsRealHostTraceStore(): RequestClientsRealHostTraceStore {
  if (hostTraceStore) {
    return hostTraceStore
  }

  const store: RequestClientsRealHostTraceStore = {
    requestCalls: [],
    socketCalls: [],
  }

  const request = typeof wx.request === 'function' ? wx.request.bind(wx) : undefined
  if (request) {
    ;(wx as typeof wx & { request: typeof wx.request }).request = ((options: WechatMiniprogram.RequestOption) => {
      pushTrace(store.requestCalls, {
        enableChunked: (options as WechatMiniprogram.RequestOption & { enableChunked?: boolean }).enableChunked,
        enableHttp2: (options as WechatMiniprogram.RequestOption & { enableHttp2?: boolean }).enableHttp2,
        forceCellularNetwork: (options as WechatMiniprogram.RequestOption & { forceCellularNetwork?: boolean }).forceCellularNetwork,
        method: normalizeMethod(options.method),
        timeout: (options as WechatMiniprogram.RequestOption & { timeout?: number }).timeout,
        url: String(options.url ?? ''),
      })
      return request(options)
    }) as typeof wx.request
  }

  const connectSocket = typeof wx.connectSocket === 'function' ? wx.connectSocket.bind(wx) : undefined
  if (connectSocket) {
    ;(wx as typeof wx & { connectSocket: typeof wx.connectSocket }).connectSocket = ((options: WechatMiniprogram.ConnectSocketOption) => {
      pushTrace(store.socketCalls, {
        forceCellularNetwork: (options as WechatMiniprogram.ConnectSocketOption & { forceCellularNetwork?: boolean }).forceCellularNetwork,
        perMessageDeflate: (options as WechatMiniprogram.ConnectSocketOption & { perMessageDeflate?: boolean }).perMessageDeflate,
        protocols: normalizeProtocols(options.protocols),
        timeout: (options as WechatMiniprogram.ConnectSocketOption & { timeout?: number }).timeout,
        url: String(options.url ?? ''),
      })
      return connectSocket(options)
    }) as typeof wx.connectSocket
  }

  hostTraceStore = store
  return store
}
