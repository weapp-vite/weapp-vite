import { afterEach, describe, expect, it } from 'vitest'
import { validateNativeInspectorHeapResponse, validateNativeInspectorIdentity } from './protocol'
import { createTestCollector, deliverInspectorResponse, handshake, heapContext, rawHeapResponse, readyCollector } from './testHelpers'

const collectors: Awaited<ReturnType<typeof createTestCollector>>[] = []
afterEach(async () => {
  await Promise.allSettled(collectors.splice(0).map(collector => collector.close()))
})

describe('native Inspector heap raw protocol validation', () => {
  it.each([
    ['target count', { targetCount: 2 }],
    ['target before', { targetId: 'renderer' }],
    ['target after', { afterTargetUrl: 'http://127.0.0.1/another-target' }],
    ['isolate drift', { isolate: { id: 'another-isolate' } }],
    ['isolate error', { isolateError: 'not supported' }],
    ['post-heap isolate drift', { afterIsolate: { id: 'another-isolate' } }],
    ['missing post-heap isolate', { afterIsolate: null }],
    ['post-heap isolate error', { afterIsolateError: 'not supported' }],
    ['nested post-heap isolate error', { afterIsolate: { id: 'test-native-isolate', error: { code: -32603 } } }],
    ['isolate request reused', { isolateRequestId: 10 }],
    ['heap request missing', { requestId: null }],
    ['request order', { requestId: 11 }],
    ['post-heap request order', { afterIsolateRequestId: 12 }],
    ['native error', { error: 'Method not found' }],
    ['missing bytes', { response: {} }],
    ['formatted bytes', { response: { usedSize: '12 B', totalSize: 24 } }],
    ['negative bytes', { response: { usedSize: -1, totalSize: 24 } }],
    ['fractional bytes', { response: { usedSize: 1.5, totalSize: 24 } }],
    ['heap capacity', { response: { usedSize: 25, totalSize: 24 } }],
    ['optional byte count', { response: { usedSize: 12, totalSize: 24, backingStorageSize: '7' } }],
    ['nonfinite bytes', { response: { usedSize: Number.POSITIVE_INFINITY, totalSize: 24 } }],
    ['nested native failure', { response: { usedSize: 12, totalSize: 24, error: { code: -32603 } } }],
    ['missing timestamp', { receivedAt: null }],
    ['missing verification timestamp', { verifiedAt: null }],
    ['verification timestamp before heap', { verifiedAt: '2000-01-01T00:00:00.000Z' }],
    ['stale response', { startedAt: '2000-01-01T00:00:00.000Z' }],
    ['future response', { receivedAt: '2100-01-01T00:00:00.000Z' }],
    ['native timeout', { durationMs: 2_501 }],
  ])('rejects %s, retains the raw response, and fails the pending sample', async (_label, patch) => {
    const collector = await createTestCollector()
    collectors.push(collector)
    await readyCollector(collector)
    const read = collector.read(heapContext)
    const failure = expect(read).rejects.toThrow('Invalid native Inspector')
    const raw = { ...rawHeapResponse(collector), ...patch }
    expect((await deliverInspectorResponse(collector, raw as unknown as ReturnType<typeof rawHeapResponse>)).status).toBe(409)
    await failure
    expect(collector.records).toEqual([])
    expect(collector.rawResponses).toHaveLength(1)
    await expect(collector.close()).rejects.toThrow('Invalid native Inspector')
  })

  it('accepts an actual zero heap and optional raw native fields without manufacturing defaults', async () => {
    const collector = await createTestCollector()
    collectors.push(collector)
    const raw = rawHeapResponse(collector)
    raw.response = { usedSize: 0, totalSize: 0 }
    const at = raw.startedAt
    const result = validateNativeInspectorHeapResponse(raw, handshake(collector) as Parameters<typeof validateNativeInspectorHeapResponse>[1], 10, at, at)
    expect(result).toBe(raw)
    expect(result.response).toEqual({ usedSize: 0, totalSize: 0 })
  })

  it('rejects guessed or unrelated URLs before opening a listener', async () => {
    const collector = await createTestCollector()
    collectors.push(collector)
    for (const targetUrl of ['https://example.com/appservice/s0/_sessionId/test/mainframe', 'http://127.0.0.1/renderer', `${collector.identity.targetUrl}?different-session=1`]) {
      expect(() => validateNativeInspectorIdentity({ ...collector.identity, targetUrl })).toThrow('owned loopback AppService')
    }
  })
})
