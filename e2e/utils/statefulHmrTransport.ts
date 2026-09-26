import type { HeadlessSession, HeadlessWxRequestOption } from '../../mpcore/packages/simulator/src'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'

/** 以真实回环请求和实际 emitted 更新文件连接 headless 与开发宿主。 */
export function installStatefulHmrTransport(session: HeadlessSession, outDir: string) {
  const wx = session.getWx()
  const original = wx.request
  const pending = new Set<AbortController>()
  let closed = false
  wx.request = (option: HeadlessWxRequestOption) => {
    const url = new URL(option.url)
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || !url.port || url.pathname !== '/__weapp_vite_stateful_hmr__') {
      return original.call(wx, option)
    }
    const controller = new AbortController()
    pending.add(controller)
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(option.data),
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json() as { type: string }
      if (closed) {
        return
      }
      option.success?.({ data, statusCode: response.status, header: {}, cookies: [], errMsg: 'request:ok' })
      if (data.type === 'batch-published') {
        const source = await readFile(path.join(outDir, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8')
        if (!closed) {
          session.evaluateRuntime(`() => {\n${source}\n}`)
        }
      }
    }).catch((error) => {
      if (!closed) {
        option.fail?.(error)
      }
    }).finally(() => pending.delete(controller))
    return {
      abort: () => controller.abort(),
      onHeadersReceived() {},
      offHeadersReceived() {},
      onChunkReceived() {},
      offChunkReceived() {},
    }
  }
  return () => {
    closed = true
    wx.request = original
    for (const controller of pending) {
      controller.abort()
    }
    pending.clear()
  }
}
