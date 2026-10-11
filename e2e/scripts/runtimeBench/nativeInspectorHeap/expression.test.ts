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
      expect(first.raw).toMatchObject({ isolateRequestId: 3, requestId: 5, afterIsolateRequestId: 7, afterIsolate: { id: 'test-native-isolate' }, response: { usedSize: 123, totalSize: 456, embedderHeapUsedSize: 7, backingStorageSize: 8 } })
      const second = await collector.read({ ...heapContext, phase: 'after' })
      expect(second.raw).toMatchObject({ isolateRequestId: 9, requestId: 11, afterIsolateRequestId: 13 })
      await vi.waitFor(() => expect(collector.state.polling).toBe(true))
    }
    finally {
      await collector.close()
    }
    await expect(installed).resolves.toEqual({ status: 'stopped' })
  })

  it('rejects and preserves raw bytes when the isolate changes inside the same target during the heap request', async () => {
    const collector = await createTestCollector()
    let lastMessageId = 0
    let isolateId = 'test-native-isolate'
    const router = {
      get _lastMessageId() {
        return lastMessageId
      },
    }
    const send = (value: object) => {
      lastMessageId++
      return Promise.resolve({ ...value, getError: () => null })
    }
    const target = {
      id: () => 'main',
      inspectedURL: () => collector.identity.targetUrl,
      router: () => router,
      runtimeAgent: () => ({
        invoke_getIsolateId: () => send({ id: isolateId }),
        invoke_getHeapUsage: () => {
          isolateId = 'replacement-native-isolate'
          return send({ usedSize: 999, totalSize: 1000 })
        },
      }),
    }
    const installed = runInNewContext(collector.consoleExpression, {
      SDK: { targetManager: { targets: () => [target], mainTarget: () => target } },
      fetch: (input: string, init: RequestInit) => fetch(input, { ...init, headers: { ...init.headers, Origin: 'devtools://devtools' } }),
      performance,
    }) as Promise<unknown>
    const frontendFailure = expect(installed).rejects.toThrow('collector rejected')
    try {
      await collector.ready
      await expect(collector.read(heapContext)).rejects.toThrow('AppService isolate drift or failure')
      await frontendFailure
      expect(collector.records).toEqual([])
      expect(collector.rawResponses).toHaveLength(1)
      expect(collector.rawResponses[0]!.body).toMatchObject({ raw: {
        isolate: { id: 'test-native-isolate' },
        afterIsolate: { id: 'replacement-native-isolate' },
        response: { usedSize: 999, totalSize: 1000 },
      } })
      await expect(collector.read({ ...heapContext, phase: 'after' })).rejects.toThrow('AppService isolate drift or failure')
    }
    finally {
      await expect(collector.close()).rejects.toThrow('AppService isolate drift or failure')
    }
  })
})
