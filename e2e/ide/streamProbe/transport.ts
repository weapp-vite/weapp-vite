import type { HeadlessSession, HeadlessWxNetworkRequestTask } from '../../../mpcore/packages/simulator/src'
import { createRequestTask } from '../../../mpcore/packages/simulator/src/runtime/request/task'
/** 只为本探针挂接真实回环传输；逐次读取网络 reader，绝不缓冲后再模拟 chunk。 */
export function installStreamProbeTransport(session: HeadlessSession, baseUrl: string) {
  const origin = new URL(baseUrl)
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || !origin.port) {
    throw new Error('Expected dynamic loopback origin')
  }
  const wx = session.getWx()
  const original = wx.request
  const pending = new Set<HeadlessWxNetworkRequestTask>()
  wx.request = (option) => {
    const url = new URL(option.url)
    if (url.origin !== origin.origin || url.pathname !== '/stream' || (option.method ?? 'GET') !== 'GET') {
      return original.call(wx, option)
    }
    const controller = new AbortController()
    const request = createRequestTask(option, () => controller.abort())
    pending.add(request.task)
    void (async () => {
      try {
        const response = await fetch(option.url, { signal: controller.signal, redirect: 'error' })
        request.headers({ cookies: [], header: Object.fromEntries(response.headers), statusCode: response.status })
        const reader = response.body!.getReader()
        try {
          while (!request.settled) {
            const chunk = await reader.read()
            if (chunk.done) {
              break
            }
            request.chunk(chunk.value.slice().buffer)
          }
        }
        finally {
          reader.releaseLock()
        }
        request.succeed({ data: '', statusCode: response.status, header: Object.fromEntries(response.headers), cookies: [], errMsg: 'request:ok' })
      }
      catch {
        request.fail(new Error('request:fail network error'))
      }
      finally {
        pending.delete(request.task)
      }
    })()
    return request.task
  }
  return () => {
    wx.request = original
    for (const task of pending) {
      task.abort()
    }
    pending.clear()
  }
}
