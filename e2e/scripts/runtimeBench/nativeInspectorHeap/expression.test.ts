import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createTestCollector, heapContext } from './testHelpers'

describe('Computer Use native Inspector installation expression', () => {
  it('captures each original native request id synchronously despite intervening SDK traffic', async () => {
    const collector = await createTestCollector()
    let lastMessageId = 0
    const router = {
      get _lastMessageId() {
        return lastMessageId
      },
    }
    const send = (result: object) => {
      lastMessageId++
      return Promise.resolve().then(() => {
        // 模拟 Inspector 同时轮询；读取请求编号必须发生在这次异步推进之前。
        lastMessageId++
        return { ...result, getError: () => null }
      })
    }
    const target = {
      id: () => 'main',
      inspectedURL: () => collector.identity.targetUrl,
      router: () => router,
      runtimeAgent: () => ({
        invoke_getIsolateId: () => send({ id: 'test-native-isolate' }),
        invoke_getHeapUsage: () => send({ usedSize: 123, totalSize: 456, embedderHeapUsedSize: 7, backingStorageSize: 8 }),
      }),
    }
    const sdk = { targetManager: { targets: () => [target], mainTarget: () => target } }
    // VM 仅模拟测试中的 Inspector frontend；不连接任何真实浏览器或 IDE 后台。
    const installed = runInNewContext(collector.consoleExpression, {
      SDK: sdk,
      fetch: (input: string, init: RequestInit) => fetch(input, { ...init, headers: { ...init.headers, Origin: 'devtools://devtools' } }),
      performance,
    }) as Promise<{ status: string }>
    try {
      await collector.ready
      const first = await collector.read(heapContext)
      expect(first.raw).toMatchObject({ isolateRequestId: 3, requestId: 5, response: { usedSize: 123, totalSize: 456, embedderHeapUsedSize: 7, backingStorageSize: 8 } })
      const second = await collector.read({ ...heapContext, phase: 'after' })
      expect(second.raw).toMatchObject({ isolateRequestId: 7, requestId: 9 })
      await vi.waitFor(() => expect(collector.state.polling).toBe(true))
    }
    finally {
      await collector.close()
    }
    await expect(installed).resolves.toEqual({ status: 'stopped' })
  })
})
