import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

interface ProbeResponse {
  status: number
  location?: string
}

function probeHeaders(url: URL, signal: AbortSignal): Promise<ProbeResponse> {
  return new Promise((resolve, reject) => {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      reject(new Error(`Unsupported readiness protocol: ${url.protocol}`))
      return
    }
    const get = url.protocol === 'https:' ? httpsGet : httpGet
    // 就绪探针独占短连接，不经受影响的内置 Undici QoS 路径，也不遗留响应体或连接池。
    const request = get(url, { agent: false, signal }, (response) => {
      const result = { status: response.statusCode ?? 0, location: response.headers.location }
      response.destroy()
      request.destroy()
      resolve(result)
    })
    request.once('error', reject)
  })
}

/** 在总期限内检查 HTTP 成功响应头；网络错误交由调用方的启动重试处理。 */
export async function isHttpServerReady(url: string, timeoutMs = 2_000): Promise<boolean> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Readiness timeout must be positive and finite')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('HTTP readiness deadline exceeded')), timeoutMs)
  try {
    let target = new URL(url)
    for (let redirects = 0; ; redirects++) {
      const response = await probeHeaders(target, controller.signal)
      if (!REDIRECT_STATUSES.has(response.status) || !response.location) {
        return response.status >= 200 && response.status < 300
      }
      if (redirects === 20) {
        throw new Error('HTTP readiness redirect limit exceeded')
      }
      target = new URL(response.location, target)
    }
  }
  finally {
    clearTimeout(timeout)
  }
}
