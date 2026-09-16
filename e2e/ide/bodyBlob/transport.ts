import type { HeadlessSession, HeadlessWxRequestOption, HeadlessWxRequestTask } from '../../../mpcore/packages/simulator/src'

/** 仅将本 suite 的动态回环 /fetch 请求交给真实 HTTP 服务。 */
export function installBodyBlobTransport(session: HeadlessSession, baseUrl: string) {
  const origin = new URL(baseUrl)
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || !origin.port) {
    throw new Error('Body/Blob transport requires a dynamic loopback origin')
  }
  const endpoint = `${origin.origin}/fetch`
  const wx = session.getWx()
  const original = wx.request
  const pending = new Set<HeadlessWxRequestTask>()
  wx.request = (options: HeadlessWxRequestOption) => {
    if (options.url !== endpoint || options.method !== 'POST') {
      return original.call(wx, options)
    }
    const controller = new AbortController()
    let settled = false
    let task: HeadlessWxRequestTask
    function fail(error: unknown) {
      if (settled) {
        return
      }
      settled = true
      pending.delete(task)
      options.fail?.(error instanceof Error ? error : new Error(String(error)))
      options.complete?.()
    }
    task = {
      abort() {
        controller.abort()
        fail(new Error('request:fail abort'))
      },
    }
    pending.add(task)
    void fetch(endpoint, {
      method: 'POST',
      headers: options.header,
      body: typeof options.data === 'string' ? options.data : JSON.stringify(options.data),
      signal: controller.signal,
      redirect: 'error',
    }).then(async (response) => {
      const result = {
        data: await response.arrayBuffer(),
        statusCode: response.status,
        header: Object.fromEntries(response.headers),
        cookies: [],
        errMsg: 'request:ok',
      }
      if (!settled) {
        settled = true
        pending.delete(task)
        options.success?.(result)
        options.complete?.(result)
      }
    }).catch(fail)
    return task
  }
  return () => {
    wx.request = original
    for (const task of pending) {
      task.abort()
    }
  }
}
