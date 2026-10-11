import { afterEach, describe, expect, it, vi } from 'vitest'
import { NATIVE_HEAP_TIMEOUT_MS } from './protocol'
import { createTestCollector, deliverInspectorResponse, handshake, heapContext, inspectorHeaders, nextInspectorRequest, postInspector, rawHeapResponse, readyCollector } from './testHelpers'

const collectors: Awaited<ReturnType<typeof createTestCollector>>[] = []

async function fixture() {
  const collector = await createTestCollector()
  collectors.push(collector)
  return collector
}

afterEach(async () => {
  await Promise.allSettled(collectors.splice(0).map(collector => collector.close()))
})

describe('native Inspector heap collector ownership and deadline', () => {
  it('retains exact bytes, native ids, checkpoint and target/isolate evidence independently', async () => {
    const collector = await fixture()
    await readyCollector(collector)
    const before = collector.read(heapContext)
    const response = await deliverInspectorResponse(collector)
    expect(response.status).toBe(200)
    const evidence = await before
    expect(evidence).toMatchObject({ transport: 'native-inspector-sdk', sessionId: collector.identity.sessionId, sequence: 1, context: heapContext, raw: { targetUrl: collector.identity.targetUrl, isolate: { id: 'test-native-isolate' }, isolateRequestId: 11, requestId: 12, response: { usedSize: 12, totalSize: 24, embedderHeapUsedSize: 4, backingStorageSize: 7 }, error: null } })
    const after = collector.read({ ...heapContext, phase: 'after' })
    expect((await deliverInspectorResponse(collector, rawHeapResponse(collector, 13))).status).toBe(200)
    expect((await after).sequence).toBe(2)
    expect(collector.records).toHaveLength(2)
    expect(collector.rawResponses).toHaveLength(2)
    expect(collector.records[0]).toBe(evidence)
  })

  it('rejects missing origin and wrong token without poisoning the owned collector', async () => {
    const collector = await fixture()
    expect((await fetch(`${collector.endpoint}/ready`, { method: 'POST', body: '{}' })).status).toBe(403)
    expect((await fetch(`${collector.endpoint}/ready`, { method: 'POST', headers: { ...inspectorHeaders(collector), 'X-Runtime-Bench-Token': 'another-token' }, body: '{}' })).status).toBe(403)
    const preflight = await fetch(`${collector.endpoint}/result`, { method: 'OPTIONS', headers: { Origin: 'devtools://devtools' } })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('devtools://devtools')
    await readyCollector(collector)
  })

  it.each([
    ['another session', { sessionId: 'another-session' }],
    ['another target', { targetId: 'another-target' }],
    ['multiple targets', { targetCount: 2 }],
    ['missing isolate', { isolate: {} }],
    ['native isolate failure', { error: 'unsupported' }],
    ['missing request id', { isolateRequestId: null }],
  ])('rejects handshake %s', async (_label, patch) => {
    const collector = await fixture()
    const failedReady = expect(collector.ready).rejects.toThrow('Invalid native Inspector')
    expect((await postInspector(collector, '/ready', { ...handshake(collector), ...patch })).status).toBe(409)
    await failedReady
    await expect(collector.read(heapContext)).rejects.toThrow('Invalid native Inspector')
    await expect(collector.close()).rejects.toThrow('Invalid native Inspector')
  })

  it('rejects duplicate install and simultaneous polls', async () => {
    const collector = await fixture()
    await readyCollector(collector)
    const poll = fetch(`${collector.endpoint}/next`, { headers: inspectorHeaders(collector) })
    await vi.waitFor(() => expect(collector.state.polling).toBe(true))
    const duplicate = await fetch(`${collector.endpoint}/next`, { headers: inspectorHeaders(collector) })
    expect(duplicate.status).toBe(409)
    expect((await poll).status).toBe(409)
    await expect(collector.read(heapContext)).rejects.toThrow('concurrent polls')
    const installedTwice = await fixture()
    await readyCollector(installedTwice)
    expect((await postInspector(installedTwice, '/ready', handshake(installedTwice))).status).toBe(409)
    await expect(installedTwice.close()).rejects.toThrow('Duplicate')
  })

  it('rejects both concurrent reads without delivering an extra checkpoint', async () => {
    const collector = await fixture()
    await readyCollector(collector)
    const first = collector.read(heapContext)
    const firstFailure = expect(first).rejects.toThrow('Concurrent')
    await expect(collector.read({ ...heapContext, phase: 'after' })).rejects.toThrow('Concurrent')
    await firstFailure
    expect(collector.records).toEqual([])
  })

  it('retains a duplicate raw response and prevents subsequent samples or successful cleanup', async () => {
    const collector = await fixture()
    await readyCollector(collector)
    const read = collector.read(heapContext)
    const request = await nextInspectorRequest(collector)
    const body = { sessionId: collector.identity.sessionId, ...request, raw: rawHeapResponse(collector) }
    expect((await postInspector(collector, '/result', body)).status).toBe(200)
    await read
    expect((await postInspector(collector, '/result', body)).status).toBe(409)
    expect(collector.rawResponses).toHaveLength(2)
    await expect(collector.read(heapContext)).rejects.toThrow('duplicate')
    await expect(collector.close()).rejects.toThrow('duplicate')
  })

  it('uses the original total 2500ms budget including waiting for delivery and preserves late raw data', async () => {
    const collector = await fixture()
    await readyCollector(collector)
    const read = collector.read(heapContext)
    const failure = expect(read).rejects.toThrow('original 2500ms timeout')
    const request = await nextInspectorRequest(collector)
    await failure
    expect(NATIVE_HEAP_TIMEOUT_MS).toBe(2_500)
    expect((await postInspector(collector, '/result', { sessionId: collector.identity.sessionId, ...request, raw: rawHeapResponse(collector) })).status).toBe(409)
    expect(collector.rawResponses).toHaveLength(1)
    expect(collector.records).toEqual([])
    await expect(collector.close()).rejects.toThrow('original 2500ms timeout')
  })

  it('closes only its listener once, releases a waiting frontend, and rejects pending or future reads', async () => {
    const collector = await fixture()
    await readyCollector(collector)
    const poll = fetch(`${collector.endpoint}/next`, { headers: inspectorHeaders(collector) })
    await vi.waitFor(() => expect(collector.state.polling).toBe(true))
    const close = collector.close()
    expect(collector.close()).toBe(close)
    await close
    expect((await poll).status).toBe(204)
    await expect(collector.read(heapContext)).rejects.toThrow('closed')
    await expect(fetch(collector.endpoint)).rejects.toThrow()
    const pendingCollector = await fixture()
    await readyCollector(pendingCollector)
    const read = pendingCollector.read(heapContext)
    const cancelled = expect(read).rejects.toThrow('closed')
    await pendingCollector.close()
    await cancelled
  })
})
