export interface AppServiceHeapUsageOptions {
  /** 单次协议请求的超时预算，单位毫秒。 */
  timeout?: number
}

export type AppServiceHeapUsage = {
  status: 'available'
  source: 'appservice-cdp-runtime'
  usedSize: number
  totalSize: number
} | {
  status: 'unsupported'
  source: 'appservice-cdp-runtime'
  reason: 'protocol-unimplemented' | 'method-not-found'
}

type Send = (method: string, params: Record<string, unknown>, options: { timeout: number }) => Promise<unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function unsupported(reason: 'protocol-unimplemented' | 'method-not-found'): AppServiceHeapUsage {
  return { status: 'unsupported', source: 'appservice-cdp-runtime', reason }
}

/** 只读取 AppService 当前 V8 堆，不调用 GC，也不把协议故障或空响应当成零内存。 */
export async function readAppServiceHeapUsage(send: Send, options: AppServiceHeapUsageOptions = {}): Promise<AppServiceHeapUsage> {
  const timeout = options.timeout ?? 2_500
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError('AppService heap timeout must be finite and positive')
  }
  let response: unknown
  try {
    response = await send('App.CDPCommand', { domain: 'Runtime', method: 'getHeapUsage', params: {} }, { timeout })
  }
  catch (error) {
    if (error instanceof Error && error.message === 'appservice App.CDPCommand unimplemented') {
      return unsupported('protocol-unimplemented')
    }
    if (error instanceof Error && error.message === '\'Runtime.getHeapUsage\' wasn\'t found') {
      return unsupported('method-not-found')
    }
    throw error
  }
  if (isRecord(response) && isRecord(response.error) && response.error.code === -32601) {
    return unsupported('method-not-found')
  }
  if (!isRecord(response) || response.error || response.exceptionDetails
    || typeof response.usedSize !== 'number' || !Number.isFinite(response.usedSize) || response.usedSize < 0
    || typeof response.totalSize !== 'number' || !Number.isFinite(response.totalSize) || response.totalSize < response.usedSize) {
    throw new Error('Invalid AppService Runtime.getHeapUsage response: expected finite non-negative usedSize <= totalSize')
  }
  return { status: 'available', source: 'appservice-cdp-runtime', usedSize: response.usedSize, totalSize: response.totalSize }
}
