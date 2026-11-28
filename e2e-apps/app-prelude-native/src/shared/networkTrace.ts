interface NativeRequestTrace {
  url: string
  method: string
  timeout?: number
  enableHttp2?: boolean
  enableChunked?: boolean
}

interface NativeSocketTrace {
  url: string
  timeout?: number
  perMessageDeflate?: boolean
  header?: Record<string, string>
}

interface NativeNetworkTrace {
  requestCalls: NativeRequestTrace[]
  socketCalls: NativeSocketTrace[]
}

const nativeNetworkTraceHost = globalThis as typeof globalThis & {
  __appPreludeNativeNetworkTrace__?: NativeNetworkTrace
}

export function installNativeNetworkTrace() {
  if (nativeNetworkTraceHost.__appPreludeNativeNetworkTrace__) {
    return nativeNetworkTraceHost.__appPreludeNativeNetworkTrace__
  }

  const trace: NativeNetworkTrace = { requestCalls: [], socketCalls: [] }
  nativeNetworkTraceHost.__appPreludeNativeNetworkTrace__ = trace

  if (typeof wx.request === 'function') {
    const request = wx.request.bind(wx)
    wx.request = ((options: WechatMiniprogram.RequestOption) => {
      const nativeOptions = options as WechatMiniprogram.RequestOption & {
        enableChunked?: boolean
        enableHttp2?: boolean
        timeout?: number
      }
      trace.requestCalls.push({
        url: String(options.url ?? ''),
        method: String(options.method ?? 'GET').toUpperCase(),
        timeout: nativeOptions.timeout,
        enableHttp2: nativeOptions.enableHttp2,
        enableChunked: nativeOptions.enableChunked,
      })
      return request(options)
    }) as typeof wx.request
  }

  if (typeof wx.connectSocket === 'function') {
    const connectSocket = wx.connectSocket.bind(wx)
    wx.connectSocket = ((options: WechatMiniprogram.ConnectSocketOption) => {
      trace.socketCalls.push({
        url: String(options.url ?? ''),
        timeout: options.timeout,
        perMessageDeflate: options.perMessageDeflate,
        header: options.header,
      })
      return connectSocket(options)
    }) as typeof wx.connectSocket
  }

  return trace
}

export function resolveNativeNetworkTrace(): NativeNetworkTrace {
  return installNativeNetworkTrace()
}
