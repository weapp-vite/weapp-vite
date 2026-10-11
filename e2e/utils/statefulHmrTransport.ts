import type { HeadlessSession, HeadlessWxRequestOption } from '../../mpcore/packages/simulator/src'
import { readFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'

function postJson(url: URL, data: unknown, signal: AbortSignal) {
  return new Promise<{ data: { type: string }, statusCode: number }>((resolve, reject) => {
    const payload = JSON.stringify(data)
    // 每次长轮询独占连接，避免内置 Undici 的异步 socket QoS 异常绕过请求的错误回调。
    const request = httpRequest(url, {
      method: 'POST',
      agent: false,
      headers: { 'content-type': 'application/json' },
      signal,
    }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        body += chunk
      })
      response.once('error', reject)
      response.once('end', () => {
        try {
          resolve({ data: JSON.parse(body) as { type: string }, statusCode: response.statusCode ?? 0 })
        }
        catch (error) {
          reject(error)
        }
      })
    })
    request.once('error', reject)
    request.end(payload)
  })
}

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
    void postJson(url, option.data, controller.signal).then(async ({ data, statusCode }) => {
      if (closed) {
        return
      }
      option.success?.({ data, statusCode, header: {}, cookies: [], errMsg: 'request:ok' })
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
