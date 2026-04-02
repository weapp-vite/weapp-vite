export type WeapiNetworkMethod = 'request' | 'uploadFile' | 'downloadFile' | 'connectSocket'
export type WeapiNetworkBucket = 'http' | 'socket'

export interface WeapiNetworkTimeoutConfig {
  request: number
  uploadFile: number
  downloadFile: number
  connectSocket: number
}

export interface WeapiActiveNetworkCall {
  bucket: WeapiNetworkBucket
  method: WeapiNetworkMethod
  platform?: string
  settled: boolean
  timeoutTimer?: ReturnType<typeof setTimeout>
  backgroundTimer?: ReturnType<typeof setTimeout>
  abort?: () => void
  failWith: (error: { errMsg: string }) => void
}

export interface WeapiPreparedNetworkCall {
  args: unknown[]
  blockedError?: { errMsg: string }
  invoke: (invokeRuntime: () => any) => any
}

export interface WeapiQueuedNetworkCall {
  start: () => any
}

export const NETWORK_METHODS = new Set<WeapiNetworkMethod>([
  'request',
  'uploadFile',
  'downloadFile',
  'connectSocket',
])

export const HTTP_METHODS = new Set<WeapiNetworkMethod>(['request', 'uploadFile', 'downloadFile'])

export const DEFAULT_TIMEOUT_CONFIG: WeapiNetworkTimeoutConfig = {
  request: 60_000,
  uploadFile: 60_000,
  downloadFile: 60_000,
  connectSocket: 60_000,
}

export const NETWORK_BUCKET_LIMIT: Record<WeapiNetworkBucket, number> = {
  http: 10,
  socket: 5,
}

export const BACKGROUND_INTERRUPT_DELAY = 5_000
export const DEFAULT_MAX_QUEUE_SIZE = 100
