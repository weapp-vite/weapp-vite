/** 不包含请求地址、业务数据或回调的宿主中立网络默认选项。 */
export interface WeapiMiniProgramRequestDefaults {
  enableCache?: boolean
  enableChunked?: boolean
  enableHttp2?: boolean
  enableHttpDNS?: boolean
  enableProfile?: boolean
  enableQuic?: boolean
  forceCellularNetwork?: boolean
  httpDNSServiceId?: string
  httpDNSTimeout?: number
  redirect?: 'follow' | 'manual'
  timeout?: number
  useHighPerformanceMode?: boolean
}

/** 不包含连接地址、协议或回调的宿主中立 WebSocket 默认选项。 */
export interface WeapiMiniProgramSocketDefaults {
  forceCellularNetwork?: boolean
  header?: Record<string, any>
  perMessageDeflate?: boolean
  timeout?: number
}
