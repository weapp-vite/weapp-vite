import type { Readable } from 'node:stream'
import type { RegistryOptions } from './config'
import makeFetch from 'make-fetch-happen'
import registryFetch from 'npm-registry-fetch'
import { proxyOptions } from './proxy'

interface RegistryAuth {
  token: string | null
  auth: string | null
  cert: string | null
  key: string | null
}

// npm-registry-fetch 19 的公开入口导出此函数，社区类型尚未包含它。
const { getAuth } = registryFetch as typeof registryFetch & {
  getAuth: (uri: string, options: RegistryOptions) => RegistryAuth
}

/** 复用 npm 的认证解析和网络传输，限制认证请求的重定向边界。 */
export async function requestMetadata(uri: string, options: RegistryOptions, signal: AbortSignal, timeout: number): Promise<unknown> {
  const auth = getAuth(uri, options)
  const headers: Record<string, string> = { accept: 'application/vnd.npm.install-v1+json' }
  if (auth.token) {
    headers.authorization = `Bearer ${auth.token}`
  }
  else if (auth.auth) {
    headers.authorization = `Basic ${auth.auth}`
  }
  const cert = auth.cert || options.cert
  const key = auth.key || options.key
  const fetchOptions = {
    ca: options.ca,
    cert,
    key,
    headers,
    localAddress: options.localAddress,
    strictSSL: options.strictSSL,
    // npm 的默认重定向仅比较 hostname，可能把凭据发送到其他端口或路径。
    // 带认证的源必须直接提供元数据；公开镜像仍允许常规 CDN 重定向。
    redirect: 'manual',
    retry: { retries: 1, factor: 2, minTimeout: 150, maxTimeout: 300 },
    timeout,
    signal,
  } as makeFetch.FetchOptions
  let target = uri
  for (let redirects = 0; ; redirects++) {
    const response = await makeFetch(target, { ...fetchOptions, ...proxyOptions(target, options) } as makeFetch.FetchOptions)
    if (response.ok) {
      return response.json() as Promise<unknown>
    }
    // 运行时响应体为 Minipass；提前销毁，避免错误页面持续占用连接。
    const body = response.body as Readable
    body.destroy()
    const location = response.headers.get('location')
    if ([301, 302, 303, 307, 308].includes(response.status) && location && redirects < 5 && !headers.authorization && !cert && !key) {
      const next = new URL(location, target)
      if (!['https:', 'http:'].includes(next.protocol) || next.username || next.password) {
        throw new Error('registry redirect is invalid')
      }
      // 每次跳转重新计算代理，不能把原主机的 NO_PROXY 豁免带给目标主机。
      target = next.href
      continue
    }
    throw Object.assign(new Error('registry HTTP request failed'), { statusCode: response.status })
  }
}
