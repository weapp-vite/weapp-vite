import type { RegistryOptions } from './config'
import { isIP } from 'node:net'
import process from 'node:process'

function bypassProxy(url: URL, noProxy: string) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  return noProxy.toLowerCase().split(/[,\s]+/).filter(Boolean).some((entry) => {
    if (entry === '*') {
      return true
    }
    // IPv6 必须先识别，避免把地址末段误认为端口。
    const parsed = isIP(entry) === 6 ? [entry, entry] : /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(entry)
    if (!parsed || (parsed[2] && parsed[2] !== port)) {
      return false
    }
    const host = parsed[1]!.replace(/^\[|\]$/g, '').replace(/^\*?\./, '')
    return hostname === host || (!isIP(hostname) && hostname.endsWith(`.${host}`))
  })
}

/** 显式决定代理或直连，避免 npm transport 再从缓存的环境变量恢复已禁用代理。 */
export function proxyOptions(uri: string, options: RegistryOptions) {
  const proxy = options.httpsProxy ?? options.proxy
    ?? process.env.https_proxy ?? process.env.HTTPS_PROXY
    ?? process.env.http_proxy ?? process.env.HTTP_PROXY
  const noProxy = options.noProxy ?? process.env.no_proxy ?? process.env.NO_PROXY ?? ''
  if (!proxy || bypassProxy(new URL(uri), noProxy)) {
    return { agent: false as const }
  }
  // 空数组阻止底层再次读取 NO_PROXY；匹配规则由本层统一处理。
  return { proxy, noProxy: [] as string[] }
}
