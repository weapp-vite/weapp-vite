import type Connection from './Connection'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import Page from './Page'
import { readRouteElementSnapshot } from './pageRouteSnapshot'

function createHostQueryConnection() {
  const snapshot = { id: 'probe', dataset: { state: 'ready' }, width: 80, height: 20, color: 'rgb(0, 0, 0)' }
  const receivedOptions: object[] = []
  const queryErrors: Error[] = []
  const hostPage = {
    route: 'pages/index/index',
    createSelectorQuery() {
      let callback: (nodes: object[]) => void
      const query = {
        selectAll: vi.fn(() => query),
        fields(options: object, onResult: typeof callback) {
          // 模拟 DevTools 的跨上下文传输边界：evaluate 字面量不能直接进入宿主查询。
          if (Object.getPrototypeOf(options) !== Object.prototype) {
            const error = new Error('An object could not be cloned.')
            queryErrors.push(error)
            throw error
          }
          receivedOptions.push(options)
          callback = onResult
          return query
        },
        exec() {
          callback([snapshot])
        },
      }
      return query
    },
  }
  const connection = {
    async send(_method: string, params: { functionDeclaration: string, args: unknown[] }) {
      const run = vm.runInNewContext(`(${params.functionDeclaration})`, {
        getCurrentPages: () => [hostPage],
        JSON,
        setTimeout,
        clearTimeout,
      })
      return { result: await run(...params.args) }
    },
  } as unknown as Connection
  return { connection, snapshot, receivedOptions, queryErrors }
}

describe('rendered query host realm', () => {
  it('transfers single and batched selector options without losing geometry or dataset', async () => {
    const { connection, snapshot, receivedOptions, queryErrors } = createHostQueryConnection()
    const page = new Page(connection, { id: 1, path: 'pages/index/index', query: {} })
    expect(await page.renderedNodes('#probe')).toEqual([snapshot])
    expect(await page.renderedSelectorNodes(['#probe'])).toEqual({ '#probe': [snapshot] })
    expect(queryErrors).toEqual([])
    expect(receivedOptions).toEqual([
      { id: true, dataset: true, rect: true, size: true },
      { id: true, dataset: true, rect: true, size: true },
    ])
  })

  it('preserves requested computed styles in route fallback snapshots', async () => {
    const { connection, snapshot, receivedOptions, queryErrors } = createHostQueryConnection()
    const result = await readRouteElementSnapshot(connection, 'pages/index/index', {}, '#probe', 0, [], ['color'])
    expect(result).toEqual(snapshot)
    expect(queryErrors).toEqual([])
    expect(receivedOptions).toEqual([
      { id: true, dataset: true, rect: true, size: true, computedStyle: ['color'] },
    ])
  })
})
