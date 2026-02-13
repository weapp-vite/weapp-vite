interface WxBaseResult {
  errMsg: string
}

interface CloudInitOptions {
  env?: string
  traceUser?: boolean
}

interface CloudCallFunctionOptions {
  name?: string
  data?: Record<string, unknown>
}

interface CloudBridge {
  init: (options?: CloudInitOptions) => void
  callFunction: (options?: CloudCallFunctionOptions) => Promise<unknown>
}

type CallWxAsyncSuccess = (options: unknown, result: Record<string, unknown> & WxBaseResult) => unknown
type CallWxAsyncFailure = (options: unknown, errMsg: string) => WxBaseResult

function createCloudRequestId() {
  return `web_cloud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function createCloudBridge(
  callWxAsyncSuccess: CallWxAsyncSuccess,
  callWxAsyncFailure: CallWxAsyncFailure,
): CloudBridge {
  const cloudRuntimeState = {
    env: '',
    traceUser: false,
  }
  return {
    init(options?: CloudInitOptions) {
      cloudRuntimeState.env = typeof options?.env === 'string' ? options.env : ''
      cloudRuntimeState.traceUser = Boolean(options?.traceUser)
    },
    callFunction(options?: CloudCallFunctionOptions) {
      const name = typeof options?.name === 'string' ? options.name.trim() : ''
      if (!name) {
        const failure = callWxAsyncFailure(options, 'cloud.callFunction:fail invalid function name')
        return Promise.reject(failure)
      }
      const result = callWxAsyncSuccess(options, {
        errMsg: 'cloud.callFunction:ok',
        result: {
          name,
          data: { ...(options?.data ?? {}) },
          env: cloudRuntimeState.env,
          traceUser: cloudRuntimeState.traceUser,
          mock: true,
        },
        requestID: createCloudRequestId(),
      })
      return Promise.resolve(result)
    },
  }
}
