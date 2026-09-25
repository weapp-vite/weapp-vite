import type { HeadlessSession, HeadlessWxNetworkRequestTask, HeadlessWxRequestOption } from '../../../mpcore/packages/simulator/src'
import { readFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { createRequestTask } from '../../../mpcore/packages/simulator/src/runtime/request/task'

/** 仅将当前 CLI 控制文件声明的回环 HMR 端点交给真实 HTTP，不模拟发布响应。 */
export function installStatefulHmrTransport(session: HeadlessSession, endpoint: string, updateFile: string) {
  const url = new URL(endpoint)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)
    || !url.port || url.username || url.password || url.search || url.hash
    || url.pathname !== '/__weapp_vite_stateful_hmr__') {
    throw new Error('Expected the current CLI loopback HMR endpoint')
  }
  const wx = session.getWx()
  const original = wx.request
  const pending = new Set<HeadlessWxNetworkRequestTask>()
  let disposed = false
  let publicationError: unknown
  let publication = Promise.resolve()
  wx.request = (option: HeadlessWxRequestOption & { timeout?: number }) => {
    if (disposed || option.url !== endpoint || option.method !== 'POST') {
      return original.call(wx, option)
    }
    const request = httpRequest(url, { method: 'POST', headers: option.header, agent: false })
    const task = createRequestTask(option, () => request.destroy())
    const deadline = setTimeout(() => {
      request.destroy(new Error('request:fail timeout'))
    }, option.timeout ?? 30_000)
    const finish = () => {
      clearTimeout(deadline)
      pending.delete(task.task)
    }
    pending.add(task.task)
    request.on('error', (error) => {
      finish()
      task.fail(error)
    })
    request.on('close', finish)
    request.on('response', (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        text += chunk
      })
      response.on('error', (error) => {
        finish()
        task.fail(error)
      })
      response.on('end', () => {
        finish()
        let data: unknown
        try {
          data = JSON.parse(text)
        }
        catch (error) {
          task.fail(error instanceof Error ? error : new Error(String(error)))
          return
        }
        const header = Object.fromEntries(Object.entries(response.headers)
          .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
          .map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]))
        task.succeed({ data, statusCode: response.statusCode ?? 0, header, cookies: [], errMsg: 'request:ok' })
        if (data && typeof data === 'object' && 'type' in data && data.type === 'batch-published') {
          // 对齐 IDE 的宿主补丁加载；仅执行原生 emit 的完整文件，不能合成补丁或用文件存在替代发布协议。
          publication = publication.then(async () => {
            const code = await readFile(updateFile, 'utf8')
            if (!disposed) {
              session.evaluateRuntime(`() => {\n${code}\n}`)
            }
          }).catch((error: unknown) => {
            publicationError = error
          })
        }
      })
    })
    request.end(typeof option.data === 'string' ? option.data : JSON.stringify(option.data))
    return task.task
  }
  return {
    assertHealthy() {
      if (publicationError) {
        throw publicationError
      }
    },
    async close() {
      if (disposed) {
        return
      }
      disposed = true
      wx.request = original
      for (const task of pending) {
        task.abort()
      }
      pending.clear()
      await publication
    },
  }
}
