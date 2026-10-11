import type { BenchHeapSampleContext, NativeInspectorHeapEvidence, NativeInspectorHeapIdentity, NativeInspectorHeapResponse } from './protocol'
import { randomInt } from 'node:crypto'
import { createNativeInspectorHeapCollector } from './index'

export const heapContext = { preset: 'normal', scenario: 'updateSingleCommit.diff', sampleIndex: 0, route: '/pages/update/index', phase: 'before' as const }

export function testInspectorIdentity() {
  return {
    sessionId: 'test-owned-session',
    targetUrl: `http://127.0.0.1:${randomInt(1024, 65_536)}/appservice/s0/_sessionId/test-owned-appservice/mainframe`,
    toolVersion: 'test-ide',
    sdkVersion: 'test-sdk',
  }
}

export async function createTestCollector() {
  return createNativeInspectorHeapCollector(testInspectorIdentity())
}

export type TestCollector = Awaited<ReturnType<typeof createTestCollector>>

export function inspectorHeaders(collector: TestCollector) {
  return { 'Origin': 'devtools://devtools', 'Content-Type': 'application/json', 'X-Runtime-Bench-Token': collector.token }
}

export function postInspector(collector: TestCollector, route: string, body: unknown) {
  return fetch(`${collector.endpoint}${route}`, { method: 'POST', headers: inspectorHeaders(collector), body: JSON.stringify(body) })
}

export function handshake(collector: TestCollector) {
  return {
    sessionId: collector.identity.sessionId,
    targetId: 'main',
    targetUrl: collector.identity.targetUrl,
    targetCount: 1,
    isolateRequestId: 10,
    isolate: { id: 'test-native-isolate' },
    error: null,
  }
}

export async function readyCollector(collector: TestCollector) {
  const response = await postInspector(collector, '/ready', handshake(collector))
  if (response.status !== 200) {
    throw new Error(`Test Inspector handshake failed: ${await response.text()}`)
  }
  await collector.ready
}

export async function nextInspectorRequest(collector: TestCollector) {
  const response = await fetch(`${collector.endpoint}/next`, { headers: inspectorHeaders(collector) })
  if (response.status !== 200) {
    throw new Error(`Test Inspector request failed: ${await response.text()}`)
  }
  return await response.json() as { sequence: number, nonce: string }
}

export function rawHeapResponse(collector: Pick<TestCollector, 'identity'>, isolateRequestId = 11): NativeInspectorHeapResponse {
  const at = new Date().toISOString()
  return {
    targetId: 'main',
    targetUrl: collector.identity.targetUrl,
    targetCount: 1,
    afterTargetId: 'main',
    afterTargetUrl: collector.identity.targetUrl,
    afterTargetCount: 1,
    isolateRequestId,
    isolate: { id: 'test-native-isolate' },
    isolateError: null,
    requestId: isolateRequestId + 1,
    startedAt: at,
    sentAt: at,
    receivedAt: at,
    durationMs: 0,
    response: { usedSize: 12, totalSize: 24, embedderHeapUsedSize: 4, backingStorageSize: 7 },
    error: null,
  }
}

export async function deliverInspectorResponse(collector: TestCollector, raw = rawHeapResponse(collector)) {
  const request = await nextInspectorRequest(collector)
  return postInspector(collector, '/result', { sessionId: collector.identity.sessionId, ...request, raw })
}

export function testNativeEvidence(identity: NativeInspectorHeapIdentity, context: BenchHeapSampleContext, sequence = 1): NativeInspectorHeapEvidence {
  const raw = rawHeapResponse({ identity }, 9 + sequence * 2)
  return { transport: 'native-inspector-sdk', sessionId: identity.sessionId, sequence, context, requestedAt: raw.startedAt, receivedAtNode: raw.receivedAt, elapsedMs: 0, raw }
}
